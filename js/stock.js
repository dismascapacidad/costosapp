/**
 * stock.js
 * Lógica de control de stock para insumos y productos terminados.
 * Sin DOM. Funciones puras + mutaciones sobre AppData vía saveData().
 *
 * Campos que agrega en cada insumo/producto:
 *   stockActual:  number   (unidades disponibles)
 *   stockMinimo:  number   (alerta si stockActual <= stockMinimo)
 *
 * Movimientos de stock (log):
 * AppData.movimientosStock = [{
 *   id, tipo: 'insumo'|'producto', itemId, nombre,
 *   delta: number (+ entrada, - salida),
 *   motivo: string,
 *   fecha: string ISO,
 *   esNota: boolean (true si es solo una nota sin cambio de stock)
 * }]
 */

// ── Inicialización de campos en items existentes ──────────────────────────────

/**
 * Migra insumos y productos existentes agregando campos de stock si no los tienen.
 * Se llama una sola vez al cargar, no rompe datos ya migrados.
 */
function migrarCamposStock() {
  let cambio = false;
  window.AppData.insumos.forEach(i => {
    if (i.stockActual === undefined) { i.stockActual = 0; cambio = true; }
    if (i.stockMinimo === undefined) { i.stockMinimo = 0; cambio = true; }
  });
  window.AppData.productos.forEach(p => {
    if (p.stockActual === undefined) { p.stockActual = 0; cambio = true; }
    if (p.stockMinimo === undefined) { p.stockMinimo = 0; cambio = true; }
  });
  if (!window.AppData.movimientosStock) { window.AppData.movimientosStock = []; cambio = true; }
  if (cambio) saveData(window.AppData);
}

// ── Consultas ─────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los insumos con stock bajo (stockActual <= stockMinimo y stockMinimo > 0).
 */
function getInsumosStockBajo() {
  return window.AppData.insumos.filter(
    i => i.stockMinimo > 0 && i.stockActual <= i.stockMinimo
  );
}

/**
 * Devuelve todos los productos con stock bajo.
 */
function getProductosStockBajo() {
  return window.AppData.productos.filter(
    p => p.stockMinimo > 0 && p.stockActual <= p.stockMinimo
  );
}

/**
 * Devuelve todos los ítems (insumos + productos) con stock bajo,
 * anotando el tipo para la UI de inicio.
 * @returns {Array<{ tipo, id, nombre, stockActual, stockMinimo, unidad? }>}
 */
function getAlertasStock() {
  const insumos = getInsumosStockBajo().map(i => ({
    tipo: 'insumo', id: i.id, nombre: i.nombre,
    stockActual: i.stockActual, stockMinimo: i.stockMinimo, unidad: i.unidad
  }));
  const productos = getProductosStockBajo().map(p => ({
    tipo: 'producto', id: p.id, nombre: p.nombre,
    stockActual: p.stockActual, stockMinimo: p.stockMinimo, unidad: 'u.'
  }));
  return [...insumos, ...productos];
}

// ── Actualización de stock ────────────────────────────────────────────────────

/**
 * Actualiza el stock de un ítem y registra el movimiento.
 *
 * @param {'insumo'|'producto'} tipo
 * @param {string} itemId
 * @param {number} delta    — positivo = entrada, negativo = salida
 * @param {string} motivo   — descripción del movimiento
 */
function moverStock(tipo, itemId, delta, motivo = '') {
  const lista = tipo === 'insumo' ? window.AppData.insumos : window.AppData.productos;
  const item  = lista.find(x => x.id === itemId);
  if (!item) throw new Error(`Ítem ${itemId} no encontrado.`);

  const nuevaCantidad = (item.stockActual || 0) + delta;
  if (nuevaCantidad < 0) throw new Error(`Stock insuficiente. Actual: ${item.stockActual}, solicitado: ${Math.abs(delta)}.`);

  item.stockActual = nuevaCantidad;

  window.AppData.movimientosStock.push({
    id:     generateMovimientoId(),
    tipo,
    itemId,
    nombre: item.nombre,
    delta,
    motivo: motivo.trim(),
    fecha:  new Date().toISOString(),
    esNota: false
  });

  saveData(window.AppData);
}

/**
 * Modifica el stock mínimo de un ítem.
 * @param {'insumo'|'producto'} tipo
 * @param {string} itemId
 * @param {number} minimo
 */
function setStockMinimo(tipo, itemId, minimo) {
  const lista = tipo === 'insumo' ? window.AppData.insumos : window.AppData.productos;
  const item  = lista.find(x => x.id === itemId);
  if (!item) throw new Error(`Ítem ${itemId} no encontrado.`);
  if (isNaN(minimo) || minimo < 0) throw new Error('El stock mínimo debe ser >= 0.');
  item.stockMinimo = parseFloat(minimo);
  saveData(window.AppData);
}

/**
 * Modifica el stock actual directamente (ajuste manual de inventario).
 * Registra el movimiento como "ajuste".
 */
function ajustarStock(tipo, itemId, nuevoStock, motivo = 'Ajuste manual') {
  const lista = tipo === 'insumo' ? window.AppData.insumos : window.AppData.productos;
  const item  = lista.find(x => x.id === itemId);
  if (!item) throw new Error(`Ítem ${itemId} no encontrado.`);
  if (isNaN(nuevoStock) || nuevoStock < 0) throw new Error('El stock debe ser >= 0.');

  const delta = parseFloat(nuevoStock) - (item.stockActual || 0);
  item.stockActual = parseFloat(nuevoStock);

  window.AppData.movimientosStock.push({
    id:     generateMovimientoId(),
    tipo,
    itemId,
    nombre: item.nombre,
    delta,
    motivo,
    fecha:  new Date().toISOString(),
    esNota: false
  });

  saveData(window.AppData);
}

/**
 * Registra una nota sobre un ítem sin modificar su stock.
 * La nota aparece en el log de movimientos.
 * 
 * @param {'insumo'|'producto'} tipo
 * @param {string} itemId
 * @param {string} texto - El contenido de la nota
 */
function registrarNota(tipo, itemId, texto) {
  const lista = tipo === 'insumo' ? window.AppData.insumos : window.AppData.productos;
  const item  = lista.find(x => x.id === itemId);
  if (!item) throw new Error(`Ítem ${itemId} no encontrado.`);
  if (!texto || !texto.trim()) throw new Error('La nota no puede estar vacía.');

  window.AppData.movimientosStock.push({
    id:     generateMovimientoId(),
    tipo,
    itemId,
    nombre: item.nombre,
    delta:  0,
    motivo: texto.trim(),
    fecha:  new Date().toISOString(),
    esNota: true
  });

  saveData(window.AppData);
}

/**
 * Devuelve los últimos N movimientos, más reciente primero.
 */
function getMovimientos(n = 50) {
  return [...(window.AppData.movimientosStock || [])]
    .reverse()
    .slice(0, n);
}

// ── Helper privado ────────────────────────────────────────────────────────────
function generateMovimientoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initStock() {
  migrarCamposStock();
  console.log('[stock] Módulo inicializado.');
  if (typeof renderStockPage === 'function') renderStockPage();
}
