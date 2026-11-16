(() => {
  'use strict';

  const measurementId = 'G-5LC0ZE50DY';
  const consentCookie = 'dc_analytics_consent';
  const domain = 'debtclearwith.us';
  const sharedDomain = location.hostname === domain || location.hostname.endsWith(`.${domain}`);
  const domainAttribute = sharedDomain ? `; Domain=${domain}` : '';
  const cookieAttributes = `; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  const disableFlag = `ga-disable-${measurementId}`;
  const cookiesButton = document.getElementById('analytics-toggle');
  const measurementButton = document.getElementById('analytics-measurement-toggle');
  let tagAdded = false;
  let preference;
  let pagePreference;

  function getPreference() {
    if (pagePreference) return pagePreference;
    const prefix = `${consentCookie}=`;
    const value = document.cookie.split(';').map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith(prefix))?.slice(prefix.length);
    return value === 'granted' || value === 'denied' ? value : 'cookieless';
  }

  function savePreference(value) {
    try {
      document.cookie = `${consentCookie}=${value}; Max-Age=15552000${cookieAttributes}${domainAttribute}`;
    } catch {
      // The current page can still honor the choice if browser storage is blocked.
    }
    pagePreference = undefined;
    if (getPreference() !== value) pagePreference = value;
    updateAnalytics();
  }

  function clearAnalyticsCookies() {
    for (const name of ['_ga', `_ga_${measurementId.slice(2)}`]) {
      document.cookie = `${name}=; Max-Age=0${cookieAttributes}${domainAttribute}`;
      if (sharedDomain) document.cookie = `${name}=; Max-Age=0${cookieAttributes}`;
    }
  }

  function updateAnalytics() {
    const next = getPreference();
    const cookiesAllowed = next === 'granted';
    const measurementsOff = next === 'denied';
    cookiesButton.textContent = cookiesAllowed ? 'Disable analytics cookies' : 'Enable analytics cookies';
    measurementButton.textContent = measurementsOff ? 'Enable cookieless analytics' : 'Turn off Google Analytics';
    if (next === preference) return;
    const previous = preference;
    preference = next;
    window[disableFlag] = measurementsOff;

    if (measurementsOff) {
      if (tagAdded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      if (previous === 'granted') clearAnalyticsCookies();
      return;
    }

    if (!tagAdded) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        if (arguments[0] !== 'event' || getPreference() === 'granted') window.dataLayer.push(arguments);
      };
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      window.gtag('set', 'ads_data_redaction', true);
      window.gtag('js', new Date());
    }

    if (tagAdded || cookiesAllowed) {
      window.gtag('consent', 'update', { analytics_storage: cookiesAllowed ? 'granted' : 'denied' });
    }
    if (previous === 'granted' && !cookiesAllowed) clearAnalyticsCookies();
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: sharedDomain ? domain : 'auto',
      page_location: cookiesAllowed ? location.href : `${location.origin}${location.pathname}`,
      page_referrer: cookiesAllowed ? document.referrer : '',
      send_page_view: !tagAdded || previous === 'denied',
    });

    if (!tagAdded) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.append(script);
      tagAdded = true;
    }
  }

  cookiesButton.addEventListener('click', () => {
    savePreference(getPreference() === 'granted' ? 'cookieless' : 'granted');
  });
  measurementButton.addEventListener('click', () => {
    savePreference(getPreference() === 'denied' ? 'cookieless' : 'denied');
  });
  window.addEventListener('pageshow', updateAnalytics);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateAnalytics();
  });
  updateAnalytics();
  cookiesButton.hidden = false;
  measurementButton.hidden = false;
})();
