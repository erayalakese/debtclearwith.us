(() => {
  'use strict';

  const measurementId = 'G-5LC0ZE50DY';
  const consentCookie = 'dc_analytics_consent';
  const domain = 'debtclearwith.us';
  const sharedDomain = location.hostname === domain || location.hostname.endsWith(`.${domain}`);
  const domainAttribute = sharedDomain ? `; Domain=${domain}` : '';
  const cookieAttributes = `; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  const disableFlag = `ga-disable-${measurementId}`;
  const button = document.getElementById('analytics-toggle');
  let tagAdded = false;
  let enabled = false;

  function hasConsent() {
    return document.cookie.split(';').some(cookie => cookie.trim() === `${consentCookie}=granted`);
  }

  function updateAnalytics() {
    const allowed = hasConsent();
    button.textContent = allowed ? 'Disable website analytics' : 'Enable website analytics';
    if (allowed === enabled) return;
    enabled = allowed;
    window[disableFlag] = !enabled;

    if (!enabled) {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      for (const name of ['_ga', `_ga_${measurementId.slice(2)}`]) {
        document.cookie = `${name}=; Max-Age=0${cookieAttributes}${domainAttribute}`;
        if (sharedDomain) document.cookie = `${name}=; Max-Age=0${cookieAttributes}`;
      }
      return;
    }

    if (!tagAdded) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        if (arguments[0] !== 'event' || hasConsent()) window.dataLayer.push(arguments);
      };
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      window.gtag('js', new Date());
    }

    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: sharedDomain ? domain : 'auto',
      send_page_view: !tagAdded,
    });

    if (!tagAdded) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.append(script);
      tagAdded = true;
    }
  }

  button.addEventListener('click', () => {
    const value = hasConsent() ? 'denied' : 'granted';
    document.cookie = `${consentCookie}=${value}; Max-Age=15552000${cookieAttributes}${domainAttribute}`;
    updateAnalytics();
  });
  window.addEventListener('pageshow', updateAnalytics);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateAnalytics();
  });
  updateAnalytics();
  button.hidden = false;
})();
