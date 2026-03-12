/**
 * costos.js
 * Funciones puras de cálculo de costos.
 *
 * REGLAS DE DISEÑO:
 *   - Ninguna función toca el DOM
 *   - Ninguna función accede a variables globales (window.AppData, etc.)
 *   - Todos los datos llegan por parámetro
 *   - Retornan números o lanzan Error con mensaje legible
 *
 * MODELO DE PRECIOS:
 *
 *   Precio consumidor final:
 *     Modo 'margen':  precioFinal = costoTotal / (1 - margen/100)
 *     Modo 'precio':  margenConsumidor = (1 - costoTotal/precioFinal) × 100
 *
 *   Precio distribuidor (siempre calculado sobre precioFinal):
 *     Modo 'margen':  precioDistribuidor = precioFinal × (1 - margenDistribuidor/100)
 *     Modo 'precio':  margenDistribuidor = (1 - precioDistribuidor/precioFinal) × 100
 *
 *   Ambos modos se guardan en el producto para facilitar futuros análisis estadísticos.
 */

// ── Costos de producción (sin cambio) ─────────────────────────────────────────

function calcularCostoMateriales(producto, insumos) {
  return (producto.insumos || []).reduce((total, linea) => {
    const insumo = insumos.find(i => i.id === linea.insumoId);
    if (!insumo) {
      console.warn(`[costos] Insumo ${linea.insumoId} no encontrado en "${producto.nombre}".`);
      return total;
    }
    return total + linea.cantidad * insumo.costoUnitario;
  }, 0);
}

function calcularCostoManoObra(producto) {
  return (producto.horasTrabajo || 0) * (producto.costoHora || 0);
}

function calcularCostoTotal(producto, insumos) {
  return calcularCostoMateriales(producto, insumos) + calcularCostoManoObra(producto);
}

// ── Precio consumidor final ───────────────────────────────────────────────────

/**
 * Dado un costo y un margen (%), calcula el precio final.
 * El margen es sobre el precio de venta, no sobre el costo.
 * @param {number} costo
 * @param {number} margen   0–99
 */
function precioDesdeMargen(costo, margen) {
  if (margen < 0 || margen >= 100) throw new Error('El margen debe estar entre 0 y 99%.');
  return costo / (1 - margen / 100);
}

/**
 * Dado un costo y un precio final, calcula el margen implícito.
 * @param {number} costo
 * @param {number} precio
 * @returns {number} margen en %
 */
function margenDesdePrecio(costo, precio) {
  if (precio <= 0) throw new Error('El precio debe ser mayor a 0.');
  if (precio < costo) throw new Error('El precio no puede ser menor al costo.');
  return (1 - costo / precio) * 100;
}

// ── Precio distribuidor ───────────────────────────────────────────────────────

/**
 * Calcula el precio de distribuidor como porcentaje del precio final.
 * margenDistribuidor es el descuento sobre el precio final.
 * @param {number} precioFinal
 * @param {number} margenDistribuidor   0–99
 */
function precioDistribDesdeMargen(precioFinal, margenDistribuidor) {
  if (margenDistribuidor < 0 || margenDistribuidor >= 100)
    throw new Error('El margen de distribuidor debe estar entre 0 y 99%.');
  return precioFinal * (1 - margenDistribuidor / 100);
}

/**
 * Calcula el margen de distribuidor implícito a partir del precio final y el precio distrib.
 * @param {number} precioFinal
 * @param {number} precioDistrib
 * @returns {number} margen en %
 */
function margenDistribDesdePrecio(precioFinal, precioDistrib) {
  if (precioFinal <= 0) throw new Error('El precio final debe ser mayor a 0.');
  if (precioDistrib > precioFinal) throw new Error('El precio distribuidor no puede superar el precio final.');
  return (1 - precioDistrib / precioFinal) * 100;
}

// ── Markup implícito (informativo) ───────────────────────────────────────────

/**
 * Calcula el markup implícito: cuánto porcentaje se agregó sobre el costo.
 * markup = (precio - costo) / costo × 100
 *
 * Esto es un dato informativo. El sistema determina precios por MARGEN,
 * no por markup. Se muestra para que el usuario conozca ambos indicadores.
 *
 * @param {number} costo
 * @param {number} precio
 * @returns {number} markup en %
 */
function calcularMarkupImplicito(costo, precio) {
  if (costo <= 0 || precio <= 0) return 0;
  return ((precio - costo) / costo) * 100;
}

// ── Resumen completo (función de conveniencia para la UI) ─────────────────────

/**
 * Calcula todos los valores de precio a partir del producto y los insumos.
 *
 * El producto debe tener:
 *   margenConsumidor   number    % para el precio final (si modoConsumidor === 'margen')
 *   precioFinal        number    precio manual (si modoConsumidor === 'precio')
 *   modoConsumidor     'margen'|'precio'
 *   margenDistribuidor number    % de descuento sobre precioFinal (si modoDistrib === 'margen')
 *   precioDistribuidor number    precio manual distrib (si modoDistrib === 'precio')
 *   modoDistribuidor   'margen'|'precio'
 *
 * @returns {{
 *   costoMateriales:    number,
 *   costoManoObra:      number,
 *   costoTotal:         number,
 *   margenConsumidor:   number,   // siempre calculado aunque el modo sea 'precio'
 *   precioFinal:        number,   // siempre calculado aunque el modo sea 'margen'
 *   ganancia:           number,
 *   margenDistribuidor: number,
 *   precioDistribuidor: number
 * }}
 */
function calcularResumen(producto, insumos) {
  const costoMateriales = calcularCostoMateriales(producto, insumos);
  const costoManoObra   = calcularCostoManoObra(producto);
  const costoTotal      = costoMateriales + costoManoObra;

  // ── Consumidor final ──
  let precioFinal, margenConsumidor;

  if (producto.modoConsumidor === 'precio') {
    precioFinal      = producto.precioFinal || 0;
    margenConsumidor = costoTotal > 0 && precioFinal > 0
      ? margenDesdePrecio(costoTotal, precioFinal)
      : 0;
  } else {
    // modo 'margen' (default)
    margenConsumidor = producto.margenConsumidor ?? producto.margenDeseado ?? 45;
    precioFinal      = costoTotal > 0
      ? precioDesdeMargen(costoTotal, margenConsumidor)
      : 0;
  }

  const ganancia = precioFinal - costoTotal;

  // ── Markup implícito (informativo) ──
  const markup = costoTotal > 0 && precioFinal > 0
    ? calcularMarkupImplicito(costoTotal, precioFinal)
    : 0;

  // ── Distribuidor ──
  let precioDistribuidor, margenDistribuidor;

  if (producto.modoDistribuidor === 'precio') {
    precioDistribuidor = producto.precioDistribuidor || 0;
    margenDistribuidor = precioFinal > 0 && precioDistribuidor > 0
      ? margenDistribDesdePrecio(precioFinal, precioDistribuidor)
      : 0;
  } else {
    // modo 'margen' (default)
    margenDistribuidor = producto.margenDistribuidor ?? 20;
    precioDistribuidor = precioFinal > 0
      ? precioDistribDesdeMargen(precioFinal, margenDistribuidor)
      : 0;
  }

  return {
    costoMateriales,
    costoManoObra,
    costoTotal,
    margenConsumidor,
    markup,
    precioFinal,
    ganancia,
    margenDistribuidor,
    precioDistribuidor
  };
}

// ── Compatibilidad retroactiva ────────────────────────────────────────────────
// calcularPrecioSugerido y calcularGanancia se mantienen para que presupuestos.js
// y otros módulos que los usan sigan funcionando sin cambios.

function calcularPrecioSugerido(producto, insumos) {
  return calcularResumen(producto, insumos).precioFinal;
}

function calcularGanancia(producto, insumos) {
  return calcularResumen(producto, insumos).ganancia;
}
