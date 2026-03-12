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

const DOLAR_CACHE_KEY = 'costosApp_dolarCache';
const DOLAR_API_URL   = 'https://dolarapi.com/v1/dolares/blue';

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
