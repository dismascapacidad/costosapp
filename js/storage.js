/**
 * storage.js
 * Única responsabilidad: persistencia de datos.
 *
 * FUNCIONES PÚBLICAS:
 *   loadData()            → lee AppData desde localStorage
 *   saveData(data)        → escribe AppData en localStorage
 *   exportData()          → descarga backup_costos_YYYY-MM-DD.json
 *   importData(file)      → lee un .json, valida estructura, reemplaza AppData
 *   validarEstructura(obj)→ valida shape del JSON (también usable desde tests)
 *
 * PREPARADO PARA BACKEND:
 *   Cada función tiene un comentario indicando su equivalente REST futuro.
 *   La firma de cada función no cambiará; solo cambia la implementación interna.
 */

const STORAGE_KEY = 'costosApp_v1';

const DEFAULT_DATA = {
  version: 1,
  monedaBase: 'ARS',
  tipoCambioManual: 1000,
  insumos: [],
  productos: [],
  presupuestos: [],
  movimientosStock: [],
  ordenesProduccion: [],
  config: { margenGlobalConsumidor: 45, margenGlobalDistribuidor: 20 }
};

// ── Validación de estructura ──────────────────────────────────────────────────

/**
 * Valida que un objeto tenga la estructura mínima esperada de AppData.
 * Separada de importData() para poder reutilizarse en tests o en un futuro
 * endpoint de validación server-side.
 *
 * @param  {*} obj - objeto a validar (cualquier tipo)
 * @returns {{ ok: boolean, error: string|null }}
 */
function validarEstructura(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'El archivo no contiene un objeto JSON válido.' };
  }
  if (!('version' in obj) || obj.version === undefined || obj.version === null) {
    return { ok: false, error: 'Falta el campo "version".' };
  }
  if (!Array.isArray(obj.insumos)) {
    return { ok: false, error: 'El campo "insumos" debe ser un array.' };
  }
  if (!Array.isArray(obj.productos)) {
    return { ok: false, error: 'El campo "productos" debe ser un array.' };
  }
  return { ok: true, error: null };
}

// ── loadData ──────────────────────────────────────────────────────────────────

/**
 * Lee AppData desde localStorage.
 * Hace merge defensivo con DEFAULT_DATA para tolerar versiones viejas
 * que no tengan todos los campos.
 *
 * Futura migración → GET /api/data
 *
 * @returns {Object} AppData
 */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULT_DATA), parsed);
  } catch (e) {
    console.error('[storage] loadData falló, usando defaults:', e);
    return structuredClone(DEFAULT_DATA);
  }
}

// ── saveData ──────────────────────────────────────────────────────────────────

/**
 * Persiste AppData en localStorage.
 *
 * Futura migración → PUT /api/data  (body: JSON.stringify(data))
 *
 * @param  {Object}  data - objeto AppData completo
 * @returns {boolean} true si guardó sin errores
 */
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[storage] saveData falló:', e);
    return false;
  }
}

// ── exportData ────────────────────────────────────────────────────────────────

/**
 * Descarga AppData como archivo JSON.
 * Nombre de archivo: backup_costos_YYYY-MM-DD.json
 *
 * Futura migración → GET /api/data/export  (response: blob descargable)
 */
function exportData() {
  const data     = loadData();
  const fecha    = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
  const nombre   = `backup_costos_${fecha}.json`;
  const json     = JSON.stringify(data, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);

  const a     = document.createElement('a');
  a.href      = url;
  a.download  = nombre;
  // Necesita estar en el DOM en Firefox para disparar el click
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── importData ────────────────────────────────────────────────────────────────

/**
 * Lee un archivo JSON, valida su estructura y reemplaza AppData en localStorage.
 *
 * Futura migración → POST /api/data/import  (body: FormData con el archivo)
 *
 * @param  {File} file - objeto File del input[type="file"]
 * @returns {Promise<{ data: Object }>} resuelve con los datos importados
 * @throws  {Error} si el JSON es inválido o la estructura no cumple el esquema
 */
function importData(file) {
  return new Promise((resolve, reject) => {
    // Verificar que sea un archivo antes de leer
    if (!file || !(file instanceof File)) {
      return reject(new Error('No se recibió un archivo válido.'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      // 1. Parsear JSON
      let parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (_) {
        return reject(new Error('El archivo no es un JSON válido.'));
      }

      // 2. Validar estructura
      const { ok, error } = validarEstructura(parsed);
      if (!ok) return reject(new Error(error));

      // 3. Persistir y actualizar AppData en memoria
      const guardado = saveData(parsed);
      if (!guardado) return reject(new Error('No se pudo guardar en localStorage.'));

      window.AppData = loadData();   // refrescar estado global
      resolve({ data: window.AppData });
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}
