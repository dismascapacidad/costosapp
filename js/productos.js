/**
 * productos.js
 * Lógica de negocio para productos fabricados. Solo datos, sin DOM.
 *
 * Estructura de un producto (v2):
 * {
 *   id:                 string,
 *   sku:                string,
 *   nombre:             string,
 *   categoria:          string,
 *   insumos:            [{ insumoId: string, cantidad: number }],
 *   horasTrabajo:       number,
 *   costoHora:          number,
 *
 *   // Precio consumidor final — exactamente uno de los dos define al otro
 *   modoConsumidor:     'margen' | 'precio'   (qué ingresó el usuario)
 *   margenConsumidor:   number                (% sobre precio de venta)
 *   precioFinal:        number                (precio de venta manual)
 *
 *   // Precio distribuidor — exactamente uno de los dos define al otro
 *   modoDistribuidor:   'margen' | 'precio'
 *   margenDistribuidor: number                (% de descuento sobre precioFinal)
 *   precioDistribuidor: number                (precio manual al distribuidor)
 *
 *   fechaActualizacion: string ISO
 * }
 *
 * AppData.config = {
 *   margenGlobalConsumidor:    number  (default 45)
 *   margenGlobalDistribuidor:  number  (default 20)
 * }
 */

// ── Config global ─────────────────────────────────────────────────────────────

function getConfig() {
  if (!window.AppData.config) {
    window.AppData.config = { margenGlobalConsumidor: 45, margenGlobalDistribuidor: 20 };
    saveData(window.AppData);
  }
  return window.AppData.config;
}

function setConfig(cambios) {
  window.AppData.config = { ...getConfig(), ...cambios };
  saveData(window.AppData);
}

// ── Migración de productos viejos ─────────────────────────────────────────────

/**
 * Migra productos con el esquema anterior (margenDeseado / precioDistribuidor)
 * al nuevo esquema. Se llama en initProductos y es idempotente.
 */
function migrarProductosV2() {
  let cambio = false;
  window.AppData.productos.forEach(p => {
    // Migrar campo de margen consumidor
    if (p.modoConsumidor === undefined) {
      p.modoConsumidor   = 'margen';
      p.margenConsumidor = p.margenDeseado ?? getConfig().margenGlobalConsumidor;
      p.precioFinal      = 0;
      cambio = true;
    }
    // Migrar campo de distribuidor
    if (p.modoDistribuidor === undefined) {
      if (p.precioDistribuidor && p.precioDistribuidor > 0) {
        p.modoDistribuidor   = 'precio';
        p.margenDistribuidor = 0; // se calcula al vuelo en calcularResumen
      } else {
        p.modoDistribuidor   = 'margen';
        p.margenDistribuidor = getConfig().margenGlobalDistribuidor;
        p.precioDistribuidor = 0;
      }
      cambio = true;
    }
    // Calcular y almacenar markup implícito (informativo)
    if (p.markup === undefined) {
      try {
        const r = calcularResumen(p, window.AppData.insumos);
        p.markup = r.markup;
      } catch(e) { p.markup = 0; }
      cambio = true;
    }
  });
  if (cambio) saveData(window.AppData);
}

// ── Helpers ID ────────────────────────────────────────────────────────────────

function generateProductoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Validación ────────────────────────────────────────────────────────────────

function validarCamposProducto({ nombre, sku, horasTrabajo, costoHora }) {
  if (!nombre || nombre.trim() === '')
    throw new Error('El nombre del producto no puede estar vacío.');
  if (horasTrabajo == null || isNaN(Number(horasTrabajo)) || Number(horasTrabajo) < 0)
    throw new Error('Las horas de trabajo deben ser un número >= 0.');
  if (costoHora == null || isNaN(Number(costoHora)) || Number(costoHora) < 0)
    throw new Error('El costo por hora debe ser un número >= 0.');
  if (sku !== undefined && sku !== '') {
    const { ok, error } = validarFormatoSKU(sku);
    if (!ok) throw new Error(error);
  }
}

function validarLineaInsumo(insumoId, cantidad) {
  if (!insumoId)
    throw new Error('Seleccioná un insumo.');
  if (!cantidad || isNaN(Number(cantidad)) || Number(cantidad) <= 0)
    throw new Error('La cantidad debe ser mayor a 0.');
  if (!window.AppData.insumos.find(i => i.id === insumoId))
    throw new Error('El insumo seleccionado no existe.');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function crearProducto({
  nombre, sku = '', categoria = '',
  horasTrabajo = 0, costoHora = 0,
  modoConsumidor   = 'margen',
  margenConsumidor = null,
  precioFinal      = 0,
  modoDistribuidor   = 'margen',
  margenDistribuidor = null,
  precioDistribuidor = 0
}) {
  validarCamposProducto({ nombre, sku, horasTrabajo, costoHora });

  const cfg = getConfig();
  if (sku) {
    const { ok, error } = validarSKUUnico(sku, window.AppData.productos);
    if (!ok) throw new Error(error);
  }

  return {
    id:                 generateProductoId(),
    sku:                sku.trim().toUpperCase(),
    nombre:             nombre.trim(),
    categoria:          categoria.trim(),
    insumos:            [],
    horasTrabajo:       parseFloat(horasTrabajo),
    costoHora:          parseFloat(costoHora),
    modoConsumidor,
    margenConsumidor:   margenConsumidor !== null ? parseFloat(margenConsumidor) : cfg.margenGlobalConsumidor,
    precioFinal:        parseFloat(precioFinal) || 0,
    modoDistribuidor,
    margenDistribuidor: margenDistribuidor !== null ? parseFloat(margenDistribuidor) : cfg.margenGlobalDistribuidor,
    precioDistribuidor: parseFloat(precioDistribuidor) || 0,
    // Retrocompatibilidad: mantener margenDeseado sincronizado
    margenDeseado:      margenConsumidor !== null ? parseFloat(margenConsumidor) : cfg.margenGlobalConsumidor,
    fechaActualizacion: new Date().toISOString()
  };
}

function agregarProducto(producto) {
  try {
    const r = calcularResumen(producto, window.AppData.insumos);
    producto.markup = r.markup;
  } catch(e) { producto.markup = 0; }
  window.AppData.productos.push(producto);
  saveData(window.AppData);
}

function eliminarProducto(id) {
  window.AppData.productos = window.AppData.productos.filter(p => p.id !== id);
  saveData(window.AppData);
}

function actualizarProducto(id, cambios) {
  const index = window.AppData.productos.findIndex(p => p.id === id);
  if (index === -1) throw new Error(`Producto "${id}" no encontrado.`);

  const merged = { ...window.AppData.productos[index], ...cambios };
  validarCamposProducto(merged);

  if (merged.sku) {
    const { ok, error } = validarSKUUnico(merged.sku, window.AppData.productos, id);
    if (!ok) throw new Error(error);
  }

  // Mantener margenDeseado sincronizado para retrocompatibilidad
  const margenSync = merged.modoConsumidor === 'margen'
    ? parseFloat(merged.margenConsumidor)
    : 0; // cuando es modo precio, margenDeseado no es representativo

  window.AppData.productos[index] = {
    ...merged,
    sku:                (merged.sku || '').trim().toUpperCase(),
    horasTrabajo:       parseFloat(merged.horasTrabajo),
    costoHora:          parseFloat(merged.costoHora),
    margenConsumidor:   parseFloat(merged.margenConsumidor) || 0,
    precioFinal:        parseFloat(merged.precioFinal) || 0,
    margenDistribuidor: parseFloat(merged.margenDistribuidor) || 0,
    precioDistribuidor: parseFloat(merged.precioDistribuidor) || 0,
    margenDeseado:      margenSync,
    fechaActualizacion: new Date().toISOString()
  };
  try {
    const r = calcularResumen(window.AppData.productos[index], window.AppData.insumos);
    window.AppData.productos[index].markup = r.markup;
  } catch(e) { window.AppData.productos[index].markup = 0; }
  saveData(window.AppData);
}

// ── Líneas de insumos ─────────────────────────────────────────────────────────

function agregarLineaInsumo(productoId, insumoId, cantidad) {
  validarLineaInsumo(insumoId, cantidad);
  const producto = window.AppData.productos.find(p => p.id === productoId);
  if (!producto) throw new Error(`Producto "${productoId}" no encontrado.`);
  const existente = producto.insumos.find(l => l.insumoId === insumoId);
  if (existente) { existente.cantidad = parseFloat(cantidad); }
  else           { producto.insumos.push({ insumoId, cantidad: parseFloat(cantidad) }); }
  producto.fechaActualizacion = new Date().toISOString();
  saveData(window.AppData);
}

function eliminarLineaInsumo(productoId, insumoId) {
  const producto = window.AppData.productos.find(p => p.id === productoId);
  if (!producto) throw new Error(`Producto "${productoId}" no encontrado.`);
  producto.insumos = producto.insumos.filter(l => l.insumoId !== insumoId);
  producto.fechaActualizacion = new Date().toISOString();
  saveData(window.AppData);
}

// ── Getters ───────────────────────────────────────────────────────────────────

function getProductos()      { return window.AppData.productos; }
function getProductoPorId(id){ return window.AppData.productos.find(p => p.id === id); }

// ── Init ──────────────────────────────────────────────────────────────────────

let _formProductoBound = false;

function initProductos() {
  getConfig();         // asegura que config exista en AppData
  migrarProductosV2(); // migra esquema viejo sin romper datos

  console.log('[productos] Módulo inicializado. Productos:', window.AppData.productos.length);

  // Las funciones de UI viven en el <script> inline de productos.html.
  // Se llaman aquí, después de que AppData está cargado.
  if (typeof _mostrarConfigGlobal     === 'function') _mostrarConfigGlobal();
  if (typeof poblarDropdownInsumos    === 'function') poblarDropdownInsumos();
  if (typeof limpiarFormularioProducto === 'function') limpiarFormularioProducto();
  if (typeof getCacheDolar            === 'function') {
    const cache = getCacheDolar();
    if (typeof renderDolarWidget === 'function') renderDolarWidget(cache);
  }
  if (typeof fetchDolarBlue === 'function' && typeof renderDolarWidget === 'function') {
    fetchDolarBlue().then(renderDolarWidget);
  }

  renderProductosList();
  if (!_formProductoBound) {
    bindFormProducto();
    _formProductoBound = true;
  }
}
