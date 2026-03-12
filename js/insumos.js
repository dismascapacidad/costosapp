/**
 * insumos.js
 * Lógica de negocio del módulo de insumos.
 * NO toca el DOM. Recibe datos, devuelve datos o lanza errores.
 *
 * Estructura de un insumo:
 * {
 *   id:                 string,
 *   nombre:             string,
 *   categoria:          string,
 *   unidad:             string,   // 'gramos' | 'unidad' | 'metro' | 'hora' | ...
 *   precioCompra:       number,   // precio del lote comprado
 *   cantidadCompra:     number,   // cantidad del lote (> 0)
 *   moneda:             'ARS' | 'USD',
 *   proveedor:          string,
 *   fechaActualizacion: string,   // ISO 8601
 *   costoUnitario:      number    // calculado: (precioCompra / cantidadCompra) en ARS
 * }
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Cálculo (función pura) ────────────────────────────────────────────────────

/**
 * Calcula el costo por unidad en la moneda base (ARS).
 * @param {number} precioCompra
 * @param {number} cantidadCompra  debe ser > 0
 * @param {'ARS'|'USD'} moneda
 * @param {number} tipoCambioManual
 * @returns {number}
 */
function calcularCostoUnitario(precioCompra, cantidadCompra, moneda, tipoCambioManual) {
  const precioEnARS = moneda === 'USD' ? precioCompra * tipoCambioManual : precioCompra;
  return precioEnARS / cantidadCompra;
}

// ── Validación ────────────────────────────────────────────────────────────────

/**
 * Valida campos requeridos. Lanza Error con mensaje legible si algo falla.
 */
function validarCamposInsumo({ nombre, unidad, precioCompra, cantidadCompra }) {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre del insumo no puede estar vacío.');
  }
  if (!unidad || unidad.trim() === '') {
    throw new Error('La unidad es obligatoria.');
  }
  if (precioCompra == null || isNaN(Number(precioCompra)) || Number(precioCompra) < 0) {
    throw new Error('El precio de compra debe ser un número >= 0.');
  }
  if (!cantidadCompra || isNaN(Number(cantidadCompra)) || Number(cantidadCompra) <= 0) {
    throw new Error('La cantidad de compra debe ser mayor a 0.');
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Construye un objeto insumo nuevo (sin persistir).
 */
function crearInsumo({ nombre, categoria = '', unidad, precioCompra, cantidadCompra, moneda = 'ARS', proveedor = '' }) {
  validarCamposInsumo({ nombre, unidad, precioCompra, cantidadCompra });

  const pc = parseFloat(precioCompra);
  const cc = parseFloat(cantidadCompra);

  return {
    id: generateId(),
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    unidad: unidad.trim(),
    precioCompra: pc,
    cantidadCompra: cc,
    moneda,
    proveedor: proveedor.trim(),
    fechaActualizacion: new Date().toISOString(),
    costoUnitario: calcularCostoUnitario(pc, cc, moneda, window.AppData.tipoCambioManual)
  };
}

/**
 * Agrega un insumo a AppData y persiste.
 */
function agregarInsumo(insumo) {
  window.AppData.insumos.push(insumo);
  saveData(window.AppData);
}

/**
 * Elimina un insumo por ID y persiste.
 */
function eliminarInsumo(id) {
  window.AppData.insumos = window.AppData.insumos.filter(i => i.id !== id);
  saveData(window.AppData);
}

/**
 * Actualiza un insumo, recalcula costoUnitario y persiste.
 */
function actualizarInsumo(id, cambios) {
  const index = window.AppData.insumos.findIndex(i => i.id === id);
  if (index === -1) throw new Error(`Insumo "${id}" no encontrado.`);

  const merged = { ...window.AppData.insumos[index], ...cambios };
  validarCamposInsumo(merged);

  const pc = parseFloat(merged.precioCompra);
  const cc = parseFloat(merged.cantidadCompra);

  window.AppData.insumos[index] = {
    ...merged,
    precioCompra: pc,
    cantidadCompra: cc,
    costoUnitario: calcularCostoUnitario(pc, cc, merged.moneda, window.AppData.tipoCambioManual),
    fechaActualizacion: new Date().toISOString()
  };

  saveData(window.AppData);
}

function getInsumos() {
  return window.AppData.insumos;
}

function getInsumoPorId(id) {
  return window.AppData.insumos.find(i => i.id === id);
}

// ── Inicialización ────────────────────────────────────────────────────────────

function initInsumos() {
  console.log('[insumos] Módulo inicializado. Insumos:', window.AppData.insumos.length);
  renderInsumosList();
  bindFormInsumo();
}
