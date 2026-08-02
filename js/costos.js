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
 *     precioFinal = max( costoTotal / (1 - margen/100),  producto.precioFinal )
 *     El campo `producto.precioFinal` actúa como piso: si los insumos bajan, el
 *     precio se mantiene y el margen efectivo sube. Si los insumos suben, el precio
 *     sube manteniendo el margen objetivo.
 *
 *   Precio distribuidor (siempre calculado como % de descuento sobre precioFinal):
 *     precioDistribuidor = precioFinal × (1 - margenDistribuidor/100)
 */

// ── Costos de producción (sin cambio) ─────────────────────────────────────────

function calcularCostoMateriales(producto, insumos, productos) {
  return (producto.insumos || []).reduce((total, linea) => {
    if (linea.productoId) {
      // Línea de sub-producto: usar su costo de producción (nunca el precio de venta)
      const sub = (productos || []).find(p => p.id === linea.productoId);
      if (!sub) {
        console.warn(`[costos] Sub-producto ${linea.productoId} no encontrado en "${producto.nombre}".`);
        return total;
      }
      return total + linea.cantidad * calcularCostoTotal(sub, insumos, productos);
    }
    // Línea de insumo normal
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

function calcularCostoTotal(producto, insumos, productos) {
  return calcularCostoMateriales(producto, insumos, productos) + calcularCostoManoObra(producto);
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
 * El precio siempre se calcula desde el margen objetivo del producto.
 * `producto.precioFinal` actúa como piso: si los insumos bajan y el precio
 * calculado cae por debajo del piso, se mantiene el piso y el margen efectivo
 * sube. Si los insumos suben, el precio calculado supera el piso y el precio
 * sube manteniendo el margen objetivo.
 *
 * @returns {{
 *   costoMateriales:    number,
 *   costoManoObra:      number,
 *   costoTotal:         number,
 *   margenConsumidor:   number,
 *   precioFinal:        number,
 *   ganancia:           number,
 *   markup:             number,
 *   margenDistribuidor: number,
 *   precioDistribuidor: number
 * }}
 */
function calcularResumen(producto, insumos, productos) {
  const costoMateriales = calcularCostoMateriales(producto, insumos, productos);
  const costoManoObra   = calcularCostoManoObra(producto);
  const costoTotal      = costoMateriales + costoManoObra;

  // ── Consumidor: siempre por margen objetivo, con piso ──
  const margenTarget    = producto.margenConsumidor ?? producto.margenDeseado ?? 45;
  const precioPorMargen = costoTotal > 0 ? precioDesdeMargen(costoTotal, margenTarget) : 0;
  const piso            = Number(producto.precioFinal) || 0;

  let precioFinal, margenConsumidor;
  if (piso > 0 && precioPorMargen < piso) {
    // Insumos bajaron: mantener piso, margen efectivo sube
    precioFinal      = piso;
    margenConsumidor = costoTotal > 0 ? margenDesdePrecio(costoTotal, piso) : margenTarget;
  } else {
    // Insumos subieron (o no hay piso): precio al margen objetivo
    precioFinal      = precioPorMargen;
    margenConsumidor = margenTarget;
  }

  const ganancia = precioFinal - costoTotal;
  const markup   = costoTotal > 0 && precioFinal > 0
    ? calcularMarkupImplicito(costoTotal, precioFinal)
    : 0;

  // ── Distribuidor: siempre descuento porcentual sobre precioFinal ──
  const margenDistribuidor = producto.margenDistribuidor ?? 20;
  const precioDistribuidor = precioFinal > 0
    ? precioDistribDesdeMargen(precioFinal, margenDistribuidor)
    : 0;

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

function calcularPrecioSugerido(producto, insumos, productos) {
  return calcularResumen(producto, insumos, productos).precioFinal;
}

function calcularGanancia(producto, insumos, productos) {
  return calcularResumen(producto, insumos, productos).ganancia;
}
