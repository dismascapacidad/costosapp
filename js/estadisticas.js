/**
 * estadisticas.js — v2
 * Módulo unificado: rentabilidad + ventas + cuadrantes + ABC
 */

var _ordenTabla  = { campo: 'ingresos', dir: 'desc' };
var _datosCache  = null;
var _chartsInit  = {};          // qué secciones ya renderizaron su chart
var _seccionActiva = 'tabla';

// ── Init ──────────────────────────────────────────────────────────────────────

function initEstadisticas() {
  if (!window.AppData) return;
  cargarEstadisticas();
}

function cargarEstadisticas() {
  _datosCache = calcularDatosUnificados();
  renderKPIs(_datosCache);
  renderTablaUnificada(_datosCache);
  // ABC se carga al mostrar su sección, pero iniciamos cálculo ya
  setTimeout(function() {
    var container = document.getElementById('analisis-abc-container');
    if (container) {
      try { renderAnalisisABC(); } catch(e) { console.warn('[estadisticas] ABC:', e); }
    }
  }, 80);
}

// ── Cálculo central ───────────────────────────────────────────────────────────

function calcularDatosUnificados() {
  var productos = window.AppData.productos || [];
  var insumos   = window.AppData.insumos   || [];
  var ventas    = window.AppData.ventas    || [];

  // — Ventas por productoId —
  var vMap = {};
  ventas.forEach(function(v) {
    if (!v.productoId) return;
    if (!vMap[v.productoId]) {
      vMap[v.productoId] = { unidades: 0, ingresos: 0, transacciones: 0 };
    }
    vMap[v.productoId].unidades      += (v.cantidad || 0);
    vMap[v.productoId].ingresos      += (v.total    || 0);
    vMap[v.productoId].transacciones += 1;
  });

  // — Clasificación ABC —
  var abcMap = {};
  if (ventas.length > 0) {
    try {
      var abc = calcularAnalisisABC();
      if (abc.disponible) {
        abc.productos.forEach(function(p) { abcMap[p.productoId] = p.clase; });
      }
    } catch(e) {}
  }

  // — Datos por producto —
  var items = [];
  productos.forEach(function(p) {
    try {
      // FIX: pasar productos como tercer argumento para resolver sub-productos
      var r  = calcularResumen(p, insumos, productos);
      var vd = vMap[p.id] || { unidades: 0, ingresos: 0, transacciones: 0 };
      // Ganancia bruta estimada = ingresos × margen%
      var gBruta = vd.ingresos > 0 ? vd.ingresos * (r.margenConsumidor / 100) : 0;

      items.push({
        id:            p.id,
        nombre:        p.nombre,
        sku:           p.sku || '—',
        categoria:     p.categoria || 'Sin categoría',
        costo:         r.costoTotal,
        precio:        r.precioFinal,
        margen:        r.margenConsumidor,
        gananciaUnit:  r.ganancia,
        unidades:      vd.unidades,
        ingresos:      vd.ingresos,
        transacciones: vd.transacciones,
        gananciaBruta: gBruta,
        claseABC:      abcMap[p.id] || null,
        tieneVentas:   vd.ingresos > 0
      });
    } catch(e) {
      console.warn('[estadisticas] Error en producto:', p.nombre, e.message);
    }
  });

  // — KPIs globales —
  var totalIngresos = ventas.reduce(function(s, v) { return s + (v.total || 0); }, 0);
  var totalGanBruta = items.reduce(function(s, p)  { return s + p.gananciaBruta; }, 0);

  // Margen ponderado por ingresos (si hay ventas); si no, promedio simple
  var conVentas = items.filter(function(p) { return p.ingresos > 0; });
  var margenPonderado = 0;
  if (conVentas.length > 0) {
    var sumIng = conVentas.reduce(function(s, p) { return s + p.ingresos; }, 0);
    margenPonderado = sumIng > 0
      ? conVentas.reduce(function(s, p) { return s + p.ingresos * p.margen; }, 0) / sumIng
      : 0;
  } else if (items.length > 0) {
    margenPonderado = items.reduce(function(s, p) { return s + p.margen; }, 0) / items.length;
  }

  // Top producto por ingresos
  var topPorIngreso = conVentas.length > 0
    ? conVentas.slice().sort(function(a, b) { return b.ingresos - a.ingresos; })[0]
    : null;

  // Alertas: clase A o B con margen < 40%
  var alertas = items.filter(function(p) {
    return p.tieneVentas && p.margen < 40 && (p.claseABC === 'A' || p.claseABC === 'B');
  });

  // — Ventas por mes (últimas 18 meses) —
  var mesesMap = {};
  ventas.forEach(function(v) {
    if (!v.fecha) return;
    var mes = String(v.fecha).substring(0, 7); // "YYYY-MM"
    mesesMap[mes] = (mesesMap[mes] || 0) + (v.total || 0);
  });
  var meses = Object.keys(mesesMap).sort();
  if (meses.length > 18) meses = meses.slice(meses.length - 18);

  // — Métodos de pago —
  var pagosMap = {};
  ventas.forEach(function(v) {
    var m = (v.metodoPago || '').trim() || 'No especificado';
    pagosMap[m] = (pagosMap[m] || 0) + (v.total || 0);
  });

  return {
    items:               items,
    totalProductos:      items.length,
    totalIngresos:       totalIngresos,
    totalGanBruta:       totalGanBruta,
    margenPonderado:     margenPonderado,
    topPorIngreso:       topPorIngreso,
    alertas:             alertas,
    hayVentas:           ventas.length > 0,
    meses:               meses,
    mesesMap:            mesesMap,
    pagosMap:            pagosMap,
    productosSinVentas:  items.filter(function(p) { return !p.tieneVentas; }).length
  };
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKPIs(d) {
  _t('kpi-total-productos', d.totalProductos);
  _t('kpi-productos-sub',   d.totalProductos + ' en catálogo');

  if (d.hayVentas) {
    _t('kpi-ingresos-totales', 'ARS ' + fmt(d.totalIngresos));
    _t('kpi-ingresos-sub',     'de ventas importadas');
    _t('kpi-ganancia-bruta',   'ARS ' + fmt(d.totalGanBruta));
    _t('kpi-ganancia-sub',     'estimada (ingresos × margen)');
  } else {
    _t('kpi-ingresos-totales', '—');
    _t('kpi-ingresos-sub',     'importá ventas para ver este dato');
    _t('kpi-ganancia-bruta',   '—');
    _t('kpi-ganancia-sub',     '—');
  }

  _t('kpi-margen-ponderado', fmtN(d.margenPonderado) + '%');
  _t('kpi-margen-sub', d.hayVentas ? 'ponderado por ingresos' : 'promedio simple del catálogo');

  if (d.topPorIngreso) {
    _t('kpi-top-nombre', d.topPorIngreso.nombre);
    _t('kpi-top-sub',    'ARS ' + fmt(d.topPorIngreso.ingresos) + ' en ventas');
  } else {
    _t('kpi-top-nombre', '—');
    _t('kpi-top-sub',    'sin datos de ventas');
  }

  var alertCard = document.getElementById('kpi-alertas-card');
  if (d.alertas.length > 0) {
    _t('kpi-alertas-count', d.alertas.length);
    _t('kpi-alertas-sub',
       d.alertas.length + ' producto' + (d.alertas.length !== 1 ? 's' : '') +
       ' clase A/B con margen bajo');
    if (alertCard) alertCard.classList.add('kpi-danger');
  } else {
    _t('kpi-alertas-count', '0');
    _t('kpi-alertas-sub',   'sin alertas críticas ✓');
    if (alertCard) alertCard.classList.remove('kpi-danger');
  }
}

// ── Tabla unificada ───────────────────────────────────────────────────────────

function renderTablaUnificada(d) {
  var wrapper = document.getElementById('tabla-unificada-wrapper');
  if (!wrapper) return;

  var items = _sortItems(d.items, _ordenTabla.campo, _ordenTabla.dir);

  if (items.length === 0) {
    wrapper.innerHTML = '<p class="tabla-vacia">No hay productos. <a href="productos.html">Crear productos →</a></p>';
    return;
  }

  var html = '<table class="tabla tabla-unificada">' +
    '<thead><tr>' +
    '<th class="col-sku">SKU</th>' +
    '<th class="col-nombre">Producto</th>' +
    '<th class="col-abc">ABC</th>' +
    '<th class="col-margen td-num">Margen</th>' +
    '<th class="col-costo td-num col-hide-mobile">Costo</th>' +
    '<th class="col-precio td-num col-hide-mobile">Precio</th>' +
    '<th class="col-ganunit td-num col-hide-mobile">Gan./u</th>' +
    '<th class="col-unidades td-num">Uds</th>' +
    '<th class="col-ingresos td-num">Ingresos</th>' +
    '<th class="col-ganbruta td-num col-hide-mobile">Gan.Bruta</th>' +
    '</tr></thead><tbody>';

  items.forEach(function(p) {
    var abcBadge = p.claseABC
      ? '<span class="abc-badge abc-badge-' + p.claseABC.toLowerCase() + '">' + p.claseABC + '</span>'
      : '<span class="abc-sin">—</span>';

    var mClass = p.margen >= 50 ? 'margen-excelente'
               : p.margen >= 40 ? 'margen-aceptable' : 'margen-bajo';

    var vacio = '<span class="celda-sin-datos">—</span>';

    html += '<tr>' +
      '<td class="col-sku"><span class="sku-tag">' + esc(p.sku) + '</span></td>' +
      '<td class="col-nombre">' +
        '<span class="prod-nombre">' + esc(p.nombre) + '</span>' +
        '<span class="prod-cat col-hide-mobile">' + esc(p.categoria) + '</span>' +
      '</td>' +
      '<td class="col-abc td-center">' + abcBadge + '</td>' +
      '<td class="col-margen td-num"><span class="badge-margen ' + mClass + '">' + fmtN(p.margen) + '%</span></td>' +
      '<td class="col-costo  td-num col-hide-mobile">ARS ' + fmtN(p.costo) + '</td>' +
      '<td class="col-precio td-num col-hide-mobile">ARS ' + fmtN(p.precio) + '</td>' +
      '<td class="col-ganunit td-num col-hide-mobile">ARS ' + fmtN(p.gananciaUnit) + '</td>' +
      '<td class="col-unidades td-num">' + (p.tieneVentas ? p.unidades : vacio) + '</td>' +
      '<td class="col-ingresos td-num">' + (p.tieneVentas ? 'ARS ' + fmt(p.ingresos) : vacio) + '</td>' +
      '<td class="col-ganbruta td-num col-hide-mobile">' + (p.tieneVentas ? 'ARS ' + fmt(p.gananciaBruta) : vacio) + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  wrapper.innerHTML = html;
}

function _sortItems(items, campo, dir) {
  return items.slice().sort(function(a, b) {
    if (campo === 'nombre') {
      return dir === 'asc'
        ? a.nombre.localeCompare(b.nombre, 'es')
        : b.nombre.localeCompare(a.nombre, 'es');
    }
    var vA = a[campo] || 0;
    var vB = b[campo] || 0;
    return dir === 'asc' ? vA - vB : vB - vA;
  });
}

function ordenarTablaUnificada(campo) {
  if (_ordenTabla.campo === campo) {
    _ordenTabla.dir = _ordenTabla.dir === 'asc' ? 'desc' : 'asc';
  } else {
    _ordenTabla.campo = campo;
    _ordenTabla.dir   = campo === 'nombre' ? 'asc' : 'desc';
  }
  if (_datosCache) renderTablaUnificada(_datosCache);
}

// ── Navegación de secciones ───────────────────────────────────────────────────

var _SECCIONES = ['tabla', 'cuadrantes', 'ventas', 'abc'];

function mostrarSeccion(sec) {
  _SECCIONES.forEach(function(s) {
    var el  = document.getElementById('seccion-' + s);
    var tab = document.getElementById('tab-'     + s);
    if (el)  el.style.display = 'none';
    if (tab) tab.classList.remove('active');
  });

  var el  = document.getElementById('seccion-' + sec);
  var tab = document.getElementById('tab-'     + sec);
  if (el)  el.style.display = 'block';
  if (tab) tab.classList.add('active');
  _seccionActiva = sec;

  // Renderizar charts solo la primera vez que se activa la sección
  if (!_chartsInit[sec] && _datosCache) {
    _chartsInit[sec] = true;
    if (sec === 'cuadrantes') {
      renderGraficoCuadrantes(_datosCache);
    } else if (sec === 'ventas') {
      _renderSeccionVentas(_datosCache);
    }
    // 'tabla' no tiene chart; 'abc' ya se cargó en init
  }
}

function _renderSeccionVentas(d) {
  var sinDatos  = document.getElementById('ventas-sin-datos');
  var conDatos  = document.getElementById('ventas-con-datos');
  if (!d.hayVentas) {
    if (sinDatos) sinDatos.style.display = 'block';
    if (conDatos) conDatos.style.display = 'none';
  } else {
    if (sinDatos) sinDatos.style.display = 'none';
    if (conDatos) conDatos.style.display = 'block';
    renderGraficoIngresosMes(d.meses, d.mesesMap);
    renderGraficoMetodosPago(d.pagosMap);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _t(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

/** Formatea número SIN decimales (para cifras grandes) */
function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/** Formatea número CON 2 decimales */
function fmtN(n) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Mantener retrocompatibilidad con app.js que puede llamar funciones viejas
function formatNum(n) { return fmtN(n); }
function escapar(str) { return esc(str); }
