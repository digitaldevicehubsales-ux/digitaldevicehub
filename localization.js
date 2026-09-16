(() => {
  'use strict';

  const BASE_CURRENCY = 'NGN';
  const DEFAULT_COUNTRY = 'NG';
  const LOCALIZATION_KEY = 'ddh_localization_v1';
  const FX_KEY = 'ddh_fx_ngn_v1';
  const SESSION_KEY = 'ddh_supabase_session';
  const LOCALIZATION_TTL = 24 * 60 * 60 * 1000;
  const FX_TTL = 12 * 60 * 60 * 1000;

  const COMMON_CURRENCIES = {
    NG:'NGN', US:'USD', GB:'GBP', CA:'CAD', AU:'AUD', NZ:'NZD', ZA:'ZAR', GH:'GHS',
    KE:'KES', UG:'UGX', TZ:'TZS', RW:'RWF', EG:'EGP', MA:'MAD', DZ:'DZD', TN:'TND',
    JP:'JPY', CN:'CNY', IN:'INR', KR:'KRW', SG:'SGD', MY:'MYR', TH:'THB', ID:'IDR',
    PH:'PHP', VN:'VND', PK:'PKR', BD:'BDT', LK:'LKR', AE:'AED', SA:'SAR', QA:'QAR',
    KW:'KWD', BH:'BHD', OM:'OMR', JO:'JOD', IL:'ILS', TR:'TRY', CH:'CHF', NO:'NOK',
    SE:'SEK', DK:'DKK', IS:'ISK', PL:'PLN', CZ:'CZK', HU:'HUF', RO:'RON', BG:'BGN',
    MX:'MXN', BR:'BRL', AR:'ARS', CL:'CLP', CO:'COP', PE:'PEN', UY:'UYU', PY:'PYG',
    BO:'BOB', CR:'CRC', DO:'DOP', JM:'JMD', TT:'TTD', BS:'BSD', BB:'BBD', HK:'HKD',
    TW:'TWD'
  };

  const EURO_COUNTRIES = new Set([
    'AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES','ME','XK'
  ]);

  const state = {
    country: DEFAULT_COUNTRY,
    currency: BASE_CURRENCY,
    rate: 1,
    detectedAt: 0
  };

  let lastPersistSignature = '';
  let observerQueued = false;

  const readJson = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  };

  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch {}
  };

  function validCountry(value) {
    const code = String(value || '').toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }

  function validCurrency(value) {
    const code = String(value || '').toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : '';
  }

  async function detectCountryFromIp() {
    const response = await fetch('/cdn-cgi/trace', {
      cache: 'no-store',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error('IP country lookup unavailable');
    const trace = await response.text();
    const line = trace.split('\n').find(item => item.startsWith('loc='));
    const country = validCountry(line?.slice(4));
    if (!country || country === 'XX' || country === 'T1') throw new Error('IP country unavailable');
    return country;
  }

  function countryFromBrowserLocale() {
    try {
      const locale = navigator.languages?.[0] || navigator.language || '';
      return validCountry(new Intl.Locale(locale).region);
    } catch {
      return '';
    }
  }

  async function currencyForCountry(country) {
    if (EURO_COUNTRIES.has(country)) return 'EUR';
    if (COMMON_CURRENCIES[country]) return COMMON_CURRENCIES[country];

    try {
      const response = await fetch(
        `https://restcountries.com/v3.1/alpha/${encodeURIComponent(country)}?fields=currencies`,
        { cache: 'force-cache', credentials: 'omit' }
      );
      if (!response.ok) throw new Error('Country currency lookup unavailable');
      const data = await response.json();
      const currency = validCurrency(Object.keys(data?.currencies || {})[0]);
      if (currency) return currency;
    } catch {}

    return BASE_CURRENCY;
  }

  async function getFxRate(currency) {
    if (currency === BASE_CURRENCY) return 1;

    const cached = readJson(FX_KEY);
    const cachedRate = Number(cached?.rates?.[currency]);
    const cacheFresh = cached && Date.now() - Number(cached.ts || 0) < FX_TTL;
    if (cacheFresh && Number.isFinite(cachedRate) && cachedRate > 0) return cachedRate;

    try {
      const response = await fetch('https://open.er-api.com/v6/latest/NGN', {
        cache: 'no-store',
        credentials: 'omit'
      });
      if (!response.ok) throw new Error('FX service unavailable');
      const data = await response.json();
      if (data?.result !== 'success' || !data?.rates) throw new Error('Invalid FX response');
      writeJson(FX_KEY, { ts: Date.now(), rates: data.rates });
      const rate = Number(data.rates[currency]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Currency rate unavailable');
      return rate;
    } catch (error) {
      if (Number.isFinite(cachedRate) && cachedRate > 0) return cachedRate;
      throw error;
    }
  }

  function formatNGN(amount) {
    const baseAmount = Number(amount);
    const converted = Number.isFinite(baseAmount) ? baseAmount * state.rate : 0;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: state.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: state.currency === 'NGN' ? 0 : 2
      }).format(converted);
    } catch {
      return `₦${Math.round(baseAmount || 0).toLocaleString('en-NG')}`;
    }
  }

  function extractBasePrice(element) {
    const existing = Number(element.dataset.ngnPrice);
    if (Number.isFinite(existing) && existing >= 0) return existing;

    const text = String(element.textContent || '').trim();
    if (!text || (!text.includes('₦') && !/\bNGN\b/i.test(text))) return null;
    const amount = Number(text.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return null;
    element.dataset.ngnPrice = String(amount);
    return amount;
  }

  function localizePrices(root = document) {
    const elements = root.querySelectorAll?.('.price, .phone-screen b') || [];
    for (const element of elements) {
      const amount = extractBasePrice(element);
      if (amount === null) continue;
      const signature = `${state.currency}:${state.rate}`;
      if (element.dataset.currencySignature === signature) continue;
      element.textContent = formatNGN(amount);
      element.dataset.currencySignature = signature;
      element.setAttribute('aria-label', `${element.textContent} in local currency`);
    }
  }

  function setPersistenceCookies() {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `ddh_country=${encodeURIComponent(state.country)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
    document.cookie = `ddh_currency=${encodeURIComponent(state.currency)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
  }

  async function persistForSignedInUser() {
    const cfg = window.DDH_CONFIG || {};
    const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
    const supabaseKey = String(cfg.supabasePublishableKey || '');
    if (!supabaseUrl || !supabaseKey) return;

    let session;
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return; }

    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (!userId || !accessToken) return;

    const signature = `${userId}:${state.country}:${state.currency}`;
    if (signature === lastPersistSignature) return;

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          country_code: state.country,
          currency_code: state.currency
        })
      });
      if (response.ok) lastPersistSignature = signature;
    } catch {}
  }

  function scheduleRefresh() {
    if (observerQueued) return;
    observerQueued = true;
    requestAnimationFrame(() => {
      observerQueued = false;
      localizePrices(document);
      persistForSignedInUser();
    });
  }

  async function initialize() {
    let country = '';
    let currency = '';
    const cached = readJson(LOCALIZATION_KEY);
    const cacheFresh = cached && Date.now() - Number(cached.detectedAt || 0) < LOCALIZATION_TTL;

    if (cacheFresh) {
      country = validCountry(cached.country);
      currency = validCurrency(cached.currency);
    }

    if (!country) {
      try { country = await detectCountryFromIp(); }
      catch { country = countryFromBrowserLocale() || DEFAULT_COUNTRY; }
    }

    if (!currency) currency = await currencyForCountry(country);

    let rate = 1;
    try {
      rate = await getFxRate(currency);
    } catch {
      currency = BASE_CURRENCY;
      rate = 1;
    }

    state.country = country;
    state.currency = currency;
    state.rate = rate;
    state.detectedAt = Date.now();

    writeJson(LOCALIZATION_KEY, {
      country: state.country,
      currency: state.currency,
      detectedAt: state.detectedAt
    });
    setPersistenceCookies();
    document.documentElement.dataset.country = state.country;
    document.documentElement.dataset.currency = state.currency;

    localizePrices(document);
    await persistForSignedInUser();
    return { ...state };
  }

  const ready = initialize().catch(() => ({ ...state }));

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.DDH_LOCALIZATION = {
    ready,
    state,
    formatNGN,
    refresh: scheduleRefresh,
    persistProfile: persistForSignedInUser
  };
})();
