/**
 * presupuestos.js
 * Lógica de negocio para presupuestos. Sin DOM, sin efectos secundarios.
 *
 * Estructura de un presupuesto:
 * {
 *   id:              string,
 *   numero:          number,   // correlativo autoincremental
 *   cliente:         string,
 *   validezDias:     number,   // días de validez desde fecha de emisión
 *   tipoCliente:     'consumidor' | 'distribuidor',
 *   moneda:          'ARS' | 'USD',
 *   tipoDolar:       'blue' | 'oficial' | 'divisa' | null,
 *   tipoCambio:      number,   // tasa usada al crear (ARS por USD); 0 si moneda=ARS
 *   descuento:       number,   // porcentaje 0-100
 *   costoEnvio:      number,   // en la moneda del presupuesto
 *   lineas:          [{ productoId, cantidad, precioUnitario, subtotal }],
 *   subtotalLineas:  number,
 *   montoDescuento:  number,
 *   totalSinEnvio:   number,
 *   total:           number,   // totalSinEnvio + costoEnvio
 *   fecha:           string,   // ISO
 *   fechaVencimiento:string,   // ISO
 * }
 */

// ── Helper ────────────────────────────────────────────────────────────────────

function generatePresupuestoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _siguienteNumero(presupuestos) {
  if (presupuestos.length === 0) return 1;
  return Math.max.apply(null, presupuestos.map(function(p) { return p.numero || 0; })) + 1;
}

// ── Validación ────────────────────────────────────────────────────────────────

function validarPresupuesto(params) {
  var cliente    = params.cliente;
  var validezDias = params.validezDias;
  var descuento  = params.descuento;
  var costoEnvio = params.costoEnvio;
  var lineas     = params.lineas;

  if (!cliente || cliente.trim() === '')
    throw new Error('El nombre del cliente no puede estar vacío.');
  if (!validezDias || isNaN(Number(validezDias)) || Number(validezDias) < 1)
    throw new Error('La validez debe ser al menos 1 día.');
  if (descuento == null || isNaN(Number(descuento)) || Number(descuento) < 0 || Number(descuento) >= 100)
    throw new Error('El descuento debe ser un número entre 0 y 99.');
  if (costoEnvio == null || isNaN(Number(costoEnvio)) || Number(costoEnvio) < 0)
    throw new Error('El costo de envío debe ser un número >= 0.');
  if (!Array.isArray(lineas) || lineas.length === 0)
    throw new Error('El presupuesto debe tener al menos un producto.');
}

// ── Cálculo (función pura) ────────────────────────────────────────────────────

/**
 * Resuelve el precio unitario según el tipo de cliente.
 */
function resolverPrecioUnitario(productoId, tipoCliente, productos, insumos) {
  var p = productos.find(function(x) { return x.id === productoId; });
  if (!p) throw new Error('Producto ' + productoId + ' no encontrado.');

  if (tipoCliente === 'distribuidor' && p.precioDistribuidor > 0) {
    return p.precioDistribuidor;
  }
  return calcularPrecioSugerido(p, insumos);
}

/**
 * Calcula los totales del presupuesto a partir de sus líneas y parámetros.
 */
function calcularTotalesPresupuesto(lineas, descuento, costoEnvio) {
  var subtotalLineas = lineas.reduce(function(s, l) { return s + l.cantidad * l.precioUnitario; }, 0);
  var montoDescuento = subtotalLineas * (descuento / 100);
  var totalSinEnvio  = subtotalLineas - montoDescuento;
  var total          = totalSinEnvio + costoEnvio;
  return { subtotalLineas: subtotalLineas, montoDescuento: montoDescuento, totalSinEnvio: totalSinEnvio, total: total };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Construye un presupuesto completo (sin persistir).
 */
function crearPresupuesto(campos, productos, insumos) {
  var cliente     = campos.cliente;
  var validezDias = campos.validezDias;
  var tipoCliente = campos.tipoCliente || 'consumidor';
  var moneda      = campos.moneda     || 'ARS';
  var tipoDolar   = campos.tipoDolar  || null;
  var tipoCambio  = parseFloat(campos.tipoCambio) || 0;
  var descuento   = campos.descuento  || 0;
  var costoEnvio  = campos.costoEnvio || 0;
  var lineasBase  = campos.lineasBase;

  validarPresupuesto({ cliente: cliente, validezDias: validezDias, descuento: descuento, costoEnvio: costoEnvio, lineas: lineasBase });

  var lineas = lineasBase.map(function(l) {
    var precioARS = resolverPrecioUnitario(l.productoId, tipoCliente, productos, insumos);
    var precio    = (moneda === 'USD' && tipoCambio > 0) ? precioARS / tipoCambio : precioARS;
    var p = productos.find(function(x) { return x.id === l.productoId; });
    return {
      productoId:     l.productoId,
      sku:            p ? p.sku || '—' : '—',
      nombre:         p ? p.nombre || '(desconocido)' : '(desconocido)',
      cantidad:       parseFloat(l.cantidad),
      precioUnitario: precio,
      subtotal:       parseFloat(l.cantidad) * precio
    };
  });

  var d  = parseFloat(descuento);
  var ce = parseFloat(costoEnvio);
  var totales = calcularTotalesPresupuesto(lineas, d, ce);

  var fecha = new Date();
  var fechaVencimiento = new Date(fecha);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + parseInt(validezDias));

  return {
    id:              generatePresupuestoId(),
    numero:          _siguienteNumero(window.AppData.presupuestos || []),
    cliente:         cliente.trim(),
    validezDias:     parseInt(validezDias),
    tipoCliente:     tipoCliente,
    moneda:          moneda,
    tipoDolar:       moneda === 'USD' ? tipoDolar : null,
    tipoCambio:      moneda === 'USD' ? tipoCambio : 0,
    descuento:       d,
    costoEnvio:      ce,
    lineas:          lineas,
    subtotalLineas:  totales.subtotalLineas,
    montoDescuento:  totales.montoDescuento,
    totalSinEnvio:   totales.totalSinEnvio,
    total:           totales.total,
    fecha:            fecha.toISOString(),
    fechaVencimiento: fechaVencimiento.toISOString()
  };
}

function agregarPresupuesto(presupuesto) {
  if (!window.AppData.presupuestos) window.AppData.presupuestos = [];
  window.AppData.presupuestos.push(presupuesto);
  saveData(window.AppData);
}

function eliminarPresupuesto(id) {
  window.AppData.presupuestos = (window.AppData.presupuestos || []).filter(function(p) { return p.id !== id; });
  saveData(window.AppData);
}

function getPresupuestos() {
  return window.AppData.presupuestos || [];
}

function getPresupuestoPorId(id) {
  return (window.AppData.presupuestos || []).find(function(p) { return p.id === id; });
}

// ── Inicialización (llamada por app.js) ───────────────────────────────────────

function initPresupuestos() {
  if (!window.AppData.presupuestos) {
    window.AppData.presupuestos = [];
    saveData(window.AppData);
  }
  console.log('[presupuestos] Módulo de negocio inicializado. Presupuestos:', window.AppData.presupuestos.length);
}
