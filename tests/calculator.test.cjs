// Run: node --test landing/tests/calculator.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

// Test the actual inline engine so the single-file page has no duplicated implementation.
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const engine = html.split('// CALCULATOR_ENGINE_START')[1].split('\n').slice(1).join('\n').split('// CALCULATOR_ENGINE_END')[0];
const simulate = runInNewContext(`${engine}\nsimulate;`);
const debts = [{ balance: 8000, apr: 24, payment: 300 }, { balance: 6000, apr: 15, payment: 250 }, { balance: 2000, apr: 9, payment: 150 }];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('applies monthly interest before regular and extra payments', () => {
  const result = simulate([{ balance: 1000, apr: 12, payment: 100 }], 200);
  close(result.records[0].charges[0], 10);
  close(result.records[0].minimums[0], 100);
  close(result.records[0].extras[0], 100);
  close(result.records[0].balances[0], 810);
});

test('rolls a partial final payment into the next debt in the same month', () => {
  const result = simulate([{ balance: 50, apr: 0, payment: 100 }, { balance: 1000, apr: 0, payment: 100 }], 300, 'snowball');
  close(result.records[0].minimums[0], 50);
  close(result.records[0].extras[1], 150);
  close(result.records[0].balances[1], 750);
  close(result.records[0].freed, 50);
  assert.equal(result.closed[0], 1);
  close(result.records[1].extras[1], 200);
});

test('pays regular amounts to every active debt before prioritizing extras', () => {
  const avalanche = simulate(debts, 900, 'avalanche');
  const snowball = simulate(debts, 900, 'snowball');
  assert.deepEqual(Array.from(avalanche.records[0].minimums), [300, 250, 150]);
  close(avalanche.records[0].extras[0], 200);
  close(snowball.records[0].extras[2], 200);
  assert.ok(avalanche.interest < snowball.interest);
});

test('regular-payment baseline never recycles freed payments or spends extra', () => {
  const baseline = simulate(debts, 700, 'avalanche', 'regular');
  assert.ok(baseline.records.every(r => r.extras.every(x => x === 0)));
  const steady = simulate(debts, 700);
  assert.ok(steady.months < baseline.months);
  assert.ok(steady.interest < baseline.interest);
});

test('commitment comparison starts equally and preserves only the original extra', () => {
  const steady = simulate(debts, 900);
  const release = simulate(debts, 900, 'avalanche', 'release');
  close(steady.records[0].available, release.records[0].available);
  for (const record of release.records) close(record.available - record.minimums.reduce((a, b) => a + b, 0), 200);
  assert.ok(steady.months <= release.months);
  assert.ok(steady.interest < release.interest);
});

test('every payment reconciles to principal plus interest and unused budget', () => {
  for (const strategy of ['snowball', 'avalanche']) {
    for (const mode of ['keep', 'regular', 'release']) {
      const plan = simulate(debts, 900, strategy, mode);
      assert.ok(plan.completed);
      const paid = plan.records.reduce((sum, r) => sum + r.minimums.reduce((a, b) => a + b, 0) + r.extras.reduce((a, b) => a + b, 0), 0);
      close(paid, 16000 + plan.interest);
      for (const r of plan.records) {
        close(r.available, r.minimums.reduce((a, b) => a + b, 0) + r.extras.reduce((a, b) => a + b, 0) + r.unused);
        assert.ok(r.balances.every(b => b >= 0));
      }
    }
  }
});

test('zero interest, a zero balance and half-cent payoff boundary', () => {
  const zero = simulate([{ balance: 1000, apr: 0, payment: 100 }, { balance: 0, apr: 99, payment: 300 }], 200);
  assert.equal(zero.months, 5);
  assert.equal(zero.interest, 0);
  assert.equal(zero.closed[1], 0);
  assert.equal(simulate([{ balance: .004, apr: 0, payment: 1 }], 1).months, 0);
  assert.equal(simulate([{ balance: .006, apr: 0, payment: 1 }], 1).months, 1);
  const empty = simulate([], 0);
  assert.equal(empty.completed, true);
  assert.equal(empty.months, 0);
});

test('insufficient budgets and non-amortizing plans never report completion', () => {
  const short = simulate(debts, 100);
  assert.equal(short.completed, false);
  assert.equal(short.records.length, 0);
  close(short.shortfall, 600);
  const growing = simulate([{ balance: 1000, apr: 24, payment: 10 }], 10);
  assert.equal(growing.completed, false);
  assert.equal(growing.months, 600);
});

test('larger steady budgets reduce time and interest for the same debts', () => {
  let previous;
  for (const budget of [700, 900, 1200, 2000, 20000]) {
    const current = simulate(debts, budget);
    if (previous) { assert.ok(current.months <= previous.months); assert.ok(current.interest <= previous.interest); }
    previous = current;
  }
});

test('invalid and non-finite financial values are rejected', () => {
  for (const budget of [-1, NaN, Infinity]) assert.throws(() => simulate(debts, budget));
  for (const bad of [{ balance: -1 }, { apr: -1 }, { payment: 0 }, { balance: NaN }, { apr: Infinity }]) {
    assert.throws(() => simulate([{ ...debts[0], ...bad }], 900));
  }
  assert.throws(() => simulate(debts, 900, 'unknown'));
});
