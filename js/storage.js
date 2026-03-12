/**
 * storage.js
 * Única responsabilidad: persistencia de datos.
 *
 * FUNCIONES PÚBLICAS (mismas firmas que antes):
 *   loadData()            → lee AppData (desde Supabase o localStorage)
 *   saveData(data)        → escribe AppData (en Supabase y localStorage)
 *   exportData()          → descarga backup_costos_YYYY-MM-DD.json
 *   importData(file)      → lee un .json, valida estructura, reemplaza AppData
 *   validarEstructura(obj)→ valida shape del JSON
 *
 * ESTRATEGIA DE SINCRONIZACIÓN:
 *   - SUPABASE ES LA FUENTE DE VERDAD cuando hay sesión activa
 *   - localStorage es solo caché local para velocidad
 *   - NUNCA se sobrescribe Supabase con datos vacíos
 *   - Al cargar: primero Supabase, fallback a localStorage
 *   - Al guardar: solo si hay datos reales (protección contra borrado accidental)
 */

var STORAGE_KEY = 'costosApp_v1';

var DEFAULT_DATA = {
  version: 1,
  monedaBase: 'ARS',
  tipoCambioManual: 1000,
  insumos: [],
  productos: [],
  presupuestos: [],
  movimientosStock: [],
  ordenesProduccion: [],
  clientes: [],
  ventas: [],
  config: { margenGlobalConsumidor: 45, margenGlobalDistribuidor: 20 }
};

// Flag para saber si ya se hizo la carga inicial desde Supabase
var _cargaSupabaseCompleta = false;

// Flag para evitar guardados concurrentes
var _guardandoEnSupabase = false;

// Flag para saber si los datos actuales vinieron de Supabase (fuente confiable)
var _datosDesdeSupabase = false;

// ── Validación de estructura ──────────────────────────────────────────────────

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

// ── Helpers para detectar datos vacíos ────────────────────────────────────────

/**
 * Cuenta cuántos registros reales hay en un objeto AppData.
 * Se usa para detectar si localStorage está vacío.
 */
function _contarRegistros(data) {
  if (!data) return 0;
  return (data.insumos || []).length +
         (data.productos || []).length +
         (data.presupuestos || []).length +
         (data.ordenesProduccion || []).length +
         (data.clientes || []).length +
         (data.ventas || []).length;
}

/**
 * Verifica si un dataset tiene datos significativos.
 */
function _tieneDatos(data) {
  return _contarRegistros(data) > 0;
}

// ── loadData ──────────────────────────────────────────────────────────────────

/**
 * Lee AppData. Carga instantáneamente desde localStorage,
 * y en segundo plano sincroniza con Supabase.
 *
 * @returns {Object} AppData
 */
function loadData() {
  // Carga instantánea desde localStorage (para no bloquear la UI)
  var data;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      data = structuredClone(DEFAULT_DATA);
    } else {
      var parsed = JSON.parse(raw);
      data = Object.assign(structuredClone(DEFAULT_DATA), parsed);
    }
  } catch (e) {
    console.error('[storage] loadData falló, usando defaults:', e);
    data = structuredClone(DEFAULT_DATA);
  }

  // Disparar carga desde Supabase en segundo plano (solo la primera vez)
  if (!_cargaSupabaseCompleta) {
    _cargarDesdeSupabaseAsync();
  }

  return data;
}

/**
 * Carga datos desde Supabase y actualiza AppData + localStorage.
 * Se ejecuta una sola vez, en segundo plano, sin bloquear la UI.
 * 
 * IMPORTANTE: Supabase es la fuente de verdad. Lo que venga de Supabase
 * reemplaza localStorage (incluso si Supabase tiene menos datos).
 */
async function _cargarDesdeSupabaseAsync() {
  // Solo intentar si Supabase está disponible y hay sesión
  if (typeof cargarDatosDesdeSupabase !== 'function') return;
  if (typeof getCurrentUser !== 'function') return;

  try {
    var user = await getCurrentUser();
    if (!user) {
      console.log('[storage] Sin sesión de Supabase, usando solo localStorage.');
      return;
    }

    console.log('[storage] Cargando datos desde Supabase...');
    var datosNube = await cargarDatosDesdeSupabase();

    var countNube = _contarRegistros(datosNube);
    var countLocal = _contarRegistros(window.AppData);

    console.log('[storage] Supabase tiene ' + countNube + ' registros, localStorage tiene ' + countLocal);

    // Supabase es la fuente de verdad — usamos sus datos
    if (datosNube) {
      window.AppData = Object.assign(structuredClone(DEFAULT_DATA), datosNube);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.AppData));
      _cargaSupabaseCompleta = true;
      _datosDesdeSupabase = true;

      console.log('[storage] ✓ Datos sincronizados desde Supabase.');

      // Re-renderizar la página actual
      _reRenderizarPaginaActual();
    }
  } catch (err) {
    console.warn('[storage] No se pudo cargar desde Supabase:', err.message);
    console.log('[storage] Usando localStorage como fallback.');
  }
}

/**
 * Re-renderiza el contenido de la página actual después de sincronizar.
 */
function _reRenderizarPaginaActual() {
  var page = typeof getCurrentPage === 'function' ? getCurrentPage() : '';
  if (page === 'index'           && typeof initIndex           === 'function') initIndex();
  if (page === 'insumos'         && typeof initInsumos         === 'function') initInsumos();
  if (page === 'productos'       && typeof initProductos       === 'function') initProductos();
  if (page === 'presupuestos'    && typeof initPresupuestos    === 'function') initPresupuestos();
  if (page === 'clientes'        && typeof initClientes        === 'function') initClientes();
  if (page === 'stock'           && typeof initStock           === 'function') initStock();
  if (page === 'produccion'      && typeof initProduccion      === 'function') initProduccion();
  if (page === 'estadisticas'    && typeof initEstadisticas    === 'function') initEstadisticas();
  if (page === 'importar-ventas' && typeof initImportarVentas  === 'function') initImportarVentas();
  if (page === 'simulador'       && typeof initSimulador       === 'function') initSimulador();
}

// ── saveData ──────────────────────────────────────────────────────────────────

/**
 * Persiste AppData. Guarda en localStorage (instantáneo)
 * y en Supabase (async, sin bloquear).
 *
 * PROTECCIÓN: No sincroniza a Supabase si:
 *   - Los datos están vacíos Y no vinieron originalmente de Supabase
 *   - Esto previene que un localStorage vacío borre Supabase
 *
 * @param  {Object}  data - objeto AppData completo
 * @returns {boolean} true si guardó en localStorage sin errores
 */
function saveData(data) {
  // 1. Guardar en localStorage (instantáneo, como antes)
  var ok = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] saveData localStorage falló:', e);
    ok = false;
  }

  // 2. Guardar en Supabase (async, con protección)
  var countData = _contarRegistros(data);

  // PROTECCIÓN: Si los datos están vacíos y NO vinieron de Supabase,
  // NO sincronizar (para no borrar datos reales en la nube)
  if (countData === 0 && !_datosDesdeSupabase) {
    console.warn('[storage] ⚠️ Datos vacíos y no vinieron de Supabase. NO se sincroniza para proteger datos en la nube.');
    return ok;
  }

  // Si los datos vinieron de Supabase (aunque estén vacíos), 
  // o si tienen contenido real, sincronizar normalmente
  _guardarEnSupabaseAsync(data);

  return ok;
}

/**
 * Guarda datos en Supabase en segundo plano.
 * Usa un debounce para no hacer demasiadas escrituras.
 */
var _saveTimeout = null;

function _guardarEnSupabaseAsync(data) {
  if (typeof guardarDatosEnSupabase !== 'function') return;
  if (_guardandoEnSupabase) return;

  // Debounce: esperar 2 segundos después del último cambio
  if (_saveTimeout) clearTimeout(_saveTimeout);

  _saveTimeout = setTimeout(function() {
    _guardandoEnSupabase = true;

    var countData = _contarRegistros(data);
    console.log('[storage] Sincronizando ' + countData + ' registros a Supabase...');

    guardarDatosEnSupabase(data)
      .then(function(ok) {
        if (ok) {
          console.log('[storage] ✓ Datos sincronizados a Supabase.');
        }
      })
      .catch(function(err) {
        console.warn('[storage] Error sincronizando a Supabase:', err.message);
      })
      .finally(function() {
        _guardandoEnSupabase = false;
      });
  }, 2000);
}

// ── exportData ────────────────────────────────────────────────────────────────

/**
 * Descarga AppData como archivo JSON.
 * Nombre de archivo: backup_costos_YYYY-MM-DD.json
 */
function exportData() {
  var data     = loadData();
  var fecha    = new Date().toISOString().slice(0, 10);
  var nombre   = 'backup_costos_' + fecha + '.json';
  var json     = JSON.stringify(data, null, 2);
  var blob     = new Blob([json], { type: 'application/json' });
  var url      = URL.createObjectURL(blob);

  var a     = document.createElement('a');
  a.href      = url;
  a.download  = nombre;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── importData ────────────────────────────────────────────────────────────────

/**
 * Lee un archivo JSON, valida su estructura y reemplaza AppData.
 * Guarda tanto en localStorage como en Supabase.
 * 
 * NOTA: Al importar un archivo, se marca _datosDesdeSupabase = true
 * para permitir la sincronización (el usuario está importando intencionalmente).
 *
 * @param  {File} file - objeto File del input[type="file"]
 * @returns {Promise<{ data: Object }>}
 */
function importData(file) {
  return new Promise(function(resolve, reject) {
    if (!file || !(file instanceof File)) {
      return reject(new Error('No se recibió un archivo válido.'));
    }

    var reader = new FileReader();

    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (_) {
        return reject(new Error('El archivo no es un JSON válido.'));
      }

      var resultado = validarEstructura(parsed);
      if (!resultado.ok) return reject(new Error(resultado.error));

      // Marcar que estos datos son intencionales (importación manual)
      // Esto permite que se sincronicen a Supabase
      _datosDesdeSupabase = true;

      // Guardar en localStorage y Supabase
      var guardado = saveData(parsed);
      if (!guardado) return reject(new Error('No se pudo guardar en localStorage.'));

      window.AppData = loadData();
      resolve({ data: window.AppData });
    };

    reader.onerror = function() { reject(new Error('Error al leer el archivo.')); };
    reader.readAsText(file);
  });
}

// ── Función de emergencia para forzar sync ────────────────────────────────────

/**
 * Fuerza la sincronización de los datos actuales a Supabase.
 * Usar solo cuando se sabe que los datos locales son correctos.
 * 
 * Ejecutar desde consola: forzarSyncASupabase()
 */
function forzarSyncASupabase() {
  if (!window.AppData) {
    console.error('[storage] No hay AppData cargado.');
    return;
  }
  
  var count = _contarRegistros(window.AppData);
  if (count === 0) {
    console.error('[storage] AppData está vacío. No se puede forzar sync vacío.');
    console.log('[storage] Si querés borrar todo en Supabase, usá el dashboard de Supabase.');
    return;
  }

  console.log('[storage] Forzando sincronización de ' + count + ' registros...');
  _datosDesdeSupabase = true; // Permitir sync
  _guardarEnSupabaseAsync(window.AppData);
}

// Exponer para uso desde consola
window.forzarSyncASupabase = forzarSyncASupabase;
