/**
 * dolar.js
 * Obtiene la cotización del dólar blue (compra y venta) desde DolarAPI.
 * Si falla la red, usa el último valor guardado en localStorage.
 *
 * Guarda en localStorage:
 *   { compra: number, venta: number, fecha: string ISO, fuente: 'api' | 'cache' }
 *
 * Retrocompatibilidad: el campo 'valor' sigue existiendo (= venta) para
 * que otros módulos que lo lean no rompan.
 */

const DOLAR_CACHE_KEY         = 'costosApp_dolarCache';
const DOLAR_OFICIAL_CACHE_KEY = 'costosApp_dolarOficialCache';
const DOLAR_DIVISA_CACHE_KEY  = 'costosApp_dolarDivisaCache';
const DOLAR_API_URL           = 'https://dolarapi.com/v1/dolares/blue';
const DOLAR_OFICIAL_API_URL   = 'https://dolarapi.com/v1/dolares/oficial';
const DOLAR_DIVISA_API_URL    = 'https://dolarapi.com/v1/dolares/bolsa';

/**
 * Obtiene compra y venta del dólar blue.
 * Intenta la API primero; si falla, usa cache.
 * Actualiza AppData.tipoCambioManual (venta) y AppData.dolarCompra.
 *
 * @returns {Promise<{ compra: number, venta: number, valor: number, fecha: string, fuente: 'api'|'cache' }>}
 */
async function fetchDolarBlue() {
  try {
    const res = await fetch(DOLAR_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // DolarAPI devuelve { compra, venta, ... }
    const compra = json.compra;
    const venta  = json.venta;
    if (!compra || isNaN(compra) || !venta || isNaN(venta))
      throw new Error('Respuesta inesperada de la API');

    const registro = {
      compra,
      venta,
      valor: venta, // retrocompat
      fecha: new Date().toISOString(),
      fuente: 'api'
    };

    // Guardar en cache y en AppData
    localStorage.setItem(DOLAR_CACHE_KEY, JSON.stringify(registro));
    window.AppData.tipoCambioManual = venta;
    window.AppData.dolarCompra      = compra;
    saveData(window.AppData);

    console.log(`[dolar] Cotización actualizada — compra: $${compra}, venta: $${venta}`);
    return registro;

  } catch (err) {
    console.warn('[dolar] API no disponible, usando cache:', err.message);
    return _usarCacheDolar();
  }
}

/**
 * Lee el cache local. Si no existe, devuelve valores de AppData.
 * @returns {{ compra: number, venta: number, valor: number, fecha: string|null, fuente: 'cache'|'manual' }}
 */
function _usarCacheDolar() {
  try {
    const raw = localStorage.getItem(DOLAR_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      // Migrar caches viejos que no tenían compra/venta separados
      if (!cached.venta) {
        cached.venta  = cached.valor || 0;
        cached.compra = cached.valor || 0;
      }
      return { ...cached, fuente: 'cache' };
    }
  } catch (_) {}

  // Sin cache: usar valores de AppData
  const venta  = window.AppData.tipoCambioManual || 0;
  const compra = window.AppData.dolarCompra || venta;
  return {
    compra,
    venta,
    valor: venta,
    fecha:  null,
    fuente: 'manual'
  };
}

/**
 * Devuelve los datos del cache sin hacer fetch.
 * @returns {{ compra: number, venta: number, valor: number, fecha: string|null, fuente: string } | null}
 */
function getCacheDolar() {
  try {
    const raw = localStorage.getItem(DOLAR_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.venta) {
      cached.venta  = cached.valor || 0;
      cached.compra = cached.valor || 0;
    }
    return cached;
  } catch (_) {
    return null;
  }
}

/**
 * Devuelve el dólar compra actual (para listas de precios en USD).
 * @returns {number}
 */
function getDolarCompra() {
  var cache = getCacheDolar();
  if (cache && cache.compra > 0) return cache.compra;
  if (window.AppData && window.AppData.dolarCompra > 0) return window.AppData.dolarCompra;
  if (window.AppData && window.AppData.tipoCambioManual > 0) return window.AppData.tipoCambioManual;
  return 0;
}

/**
 * Fetch genérico para cualquier tipo de dólar.
 * @param {string} url  URL de la API
 * @param {string} cacheKey  clave localStorage
 * @returns {Promise<{ compra: number, venta: number, fecha: string, fuente: 'api'|'cache' }>}
 */
async function _fetchDolar(url, cacheKey) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const compra = json.compra;
    const venta  = json.venta;
    if (!compra || isNaN(compra) || !venta || isNaN(venta))
      throw new Error('Respuesta inesperada de la API');
    const registro = { compra, venta, fecha: new Date().toISOString(), fuente: 'api' };
    localStorage.setItem(cacheKey, JSON.stringify(registro));
    return registro;
  } catch (err) {
    console.warn(`[dolar] API no disponible (${url}), usando cache:`, err.message);
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) return { ...JSON.parse(raw), fuente: 'cache' };
    } catch (_) {}
    return { compra: 0, venta: 0, fecha: null, fuente: 'cache' };
  }
}

/**
 * Obtiene compra y venta del dólar oficial.
 * @returns {Promise<{ compra: number, venta: number, fecha: string, fuente: 'api'|'cache' }>}
 */
async function fetchDolarOficial() {
  return _fetchDolar(DOLAR_OFICIAL_API_URL, DOLAR_OFICIAL_CACHE_KEY);
}

/**
 * Obtiene compra y venta del dólar divisa (MEP/bolsa).
 * @returns {Promise<{ compra: number, venta: number, fecha: string, fuente: 'api'|'cache' }>}
 */
async function fetchDolarDivisa() {
  return _fetchDolar(DOLAR_DIVISA_API_URL, DOLAR_DIVISA_CACHE_KEY);
}

/**
 * Formatea la antigüedad del dato para mostrar en la UI.
 * @param {string} fechaISO
 * @returns {string}  ej: "hace 5 minutos" | "hace 2 horas" | "hace 3 días"
 */
function formatearAntiguedad(fechaISO) {
  if (!fechaISO) return 'fecha desconocida';
  const diff = Date.now() - new Date(fechaISO).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'hace un momento';
  if (min < 60)  return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24)   return `hace ${hs} h`;
  return `hace ${Math.floor(hs / 24)} días`;
}
