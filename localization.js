(() => {
  'use strict';

  const DEFAULT_COUNTRY = 'NG';
  const DEFAULT_CURRENCY = 'NGN';
  const LOCALIZATION_KEY = 'ddh_localization_v2';
  const FX_KEY = 'ddh_fx_target_v2';
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
    currency: DEFAULT_CURRENCY,
    rates: { NGN: 1 },
    detectedAt: 0,
    fxAt: 0
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

    return DEFAULT_CURRENCY;
  }

  async function getFxRates(targetCurrency) {
    const cached = readJson(FX_KEY);
    const cacheFresh = cached && cached.base === targetCurrency && Date.now() - Number(cached.ts || 0) < FX_TTL;
    if (cacheFresh && cached.rates && typeof cached.rates === 'object') {
      return { rates: cached.rates, ts: Number(cached.ts) || Date.now() };
    }

    try {
      const runtimeCfg = window.DDH_CONFIG || {};
      const root = String(runtimeCfg.supabaseUrl || '').replace(/\/$/, '');
      const publishableKey = String(runtimeCfg.supabasePublishableKey || '');
      if (!root || !publishableKey) throw new Error('FX service unavailable');
      const response = await fetch(`${root}/functions/v1/fx-rates?currency=${encodeURIComponent(targetCurrency)}`, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { apikey: publishableKey }
      });
      if (!response.ok) throw new Error('FX service unavailable');
      const data = await response.json();
      if (!data?.rates) throw new Error('Invalid FX response');
      const payload = { base: targetCurrency, ts: Date.now(), rates: data.rates, source: data.source || 'DigitalDeviceHub FX', as_of: data.as_of || null };
      writeJson(FX_KEY, payload);
      return { rates: data.rates, ts: payload.ts, source: payload.source, as_of: payload.as_of };
    } catch (error) {
      if (cached?.base === targetCurrency && cached?.rates) {
        return { rates: cached.rates, ts: Number(cached.ts) || 0 };
      }
      throw error;
    }
  }

  function fractionDigits(currency) {
    try {
      const options = new Intl.NumberFormat(undefined,{style:'currency',currency}).resolvedOptions();
      return Math.min(4, Number(options.maximumFractionDigits) || 0);
    } catch {
      return 2;
    }
  }

  function formatCurrency(amount, currency) {
    const code = validCurrency(currency) || DEFAULT_CURRENCY;
    const value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: fractionDigits(code)
      }).format(value);
    } catch {
      return `${code} ${value.toLocaleString()}`;
    }
  }

  function convertedValue(amount, sourceCurrency) {
    const source = validCurrency(sourceCurrency) || DEFAULT_CURRENCY;
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    if (source === state.currency) return { amount: value, currency: state.currency, converted: false };

    const sourcePerTarget = Number(state.rates?.[source]);
    if (Number.isFinite(sourcePerTarget) && sourcePerTarget > 0) {
      return { amount: value / sourcePerTarget, currency: state.currency, converted: true };
    }

    return { amount: value, currency: source, converted: false };
  }

  function extractOriginalPrice(element) {
    const dataAmount = Number(element.dataset.priceAmount);
    const dataCurrency = validCurrency(element.dataset.priceCurrency);
    if (Number.isFinite(dataAmount) && dataAmount >= 0 && dataCurrency) {
      return { amount: dataAmount, currency: dataCurrency };
    }

    const text = String(element.textContent || '').trim();
    if (!text || (!text.includes('₦') && !/\bNGN\b/i.test(text))) return null;
    const amount = Number(text.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return null;
    element.dataset.priceAmount = String(amount);
    element.dataset.priceCurrency = 'NGN';
    return { amount, currency: 'NGN' };
  }

  function localizePrices(root = document) {
    const elements = root.querySelectorAll?.('.price, .phone-screen b') || [];
    for (const element of elements) {
      const original = extractOriginalPrice(element);
      if (!original) continue;

      const signature = `${original.currency}:${original.amount}:${state.currency}:${state.fxAt}`;
      if (element.dataset.currencySignature === signature) continue;

      const display = convertedValue(original.amount, original.currency);
      if (!display) continue;
      const displayText = formatCurrency(display.amount, display.currency);
      const originalText = formatCurrency(original.amount, original.currency);

      element.textContent = displayText;
      element.dataset.currencySignature = signature;
      element.setAttribute('aria-label', display.converted ? `${displayText}; seller price ${originalText}` : displayText);
      if (display.converted) element.title = `Seller price: ${originalText}`;
      else element.removeAttribute('title');
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

    state.country = country;
    state.currency = currency;
    state.detectedAt = Date.now();

    try {
      const fx = await getFxRates(currency);
      state.rates = fx.rates || { [currency]: 1 };
      state.fxAt = fx.ts || Date.now();
    } catch {
      state.rates = { [currency]: 1 };
      state.fxAt = Date.now();
    }

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
    document.dispatchEvent(new CustomEvent('ddh:localization-ready',{detail:{country:state.country,currency:state.currency}}));
    return { ...state };
  }

  const ready = initialize().catch(() => ({ ...state }));

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.DDH_LOCALIZATION = {
    ready,
    state,
    formatCurrency,
    convertAmount: convertedValue,
    refresh: scheduleRefresh,
    persistProfile: persistForSignedInUser
  };
})();
