/**
 * registro-ventas.js
 * Lógica para el registro consolidado de ventas
 * Combina: ventas importadas + órdenes de producción no espontáneas
 */

/**
 * Obtiene todas las ventas consolidadas:
 * - Ventas importadas (TiendaNube, TiendaNegocio, etc.)
 * - Órdenes de producción finalizadas NO espontáneas
 */
function obtenerVentasConsolidadas() {
  var ventas = [];
  
  // 1. Ventas importadas
  var ventasImportadas = window.AppData.ventas || [];
  ventasImportadas.forEach(function(v) {
    ventas.push({
      id: v.id,
      fecha: v.fecha,
      numeroOrden: v.ordenId || '',
      productoId: v.productoId,
      productoNombre: v.productoNombre,
      productoSKU: v.productoSKU || '',
      cantidad: v.cantidad,
      precioUnitario: v.precioUnitario || 0,
      total: v.total || 0,
      cliente: '',
      canal: v.fuente || 'importacion',
      metodoPago: '',
      origen: 'importacion',
      origenDetalle: v.fuente || 'Importación'
    });
  });
  
  // 2. Órdenes de producción finalizadas NO espontáneas
  var ordenes = window.AppData.ordenesProduccion || [];
  ordenes.forEach(function(o) {
    // Solo órdenes finalizadas y NO espontáneas
    if (o.estado !== 'finalizada' || o.espontanea === true) return;
    
    // Buscar producto para obtener precio
    var producto = window.AppData.productos.find(function(p) { return p.id === o.productoId; });
    var precioUnitario = 0;
    var total = 0;
    
    if (producto) {
      try {
        var resumen = calcularResumen(producto, window.AppData.insumos || []);
        precioUnitario = resumen.precioFinal || 0;
        total = precioUnitario * o.cantidad;
      } catch(e) {}
    }
    
    ventas.push({
      id: o.id,
      fecha: o.fechaFinalizada ? o.fechaFinalizada.split('T')[0] : o.fechaCreacion.split('T')[0],
      numeroOrden: o.numeroExterno || ('OP-' + String(o.numero).padStart(4, '0')),
      productoId: o.productoId,
      productoNombre: o.productoNombre,
      productoSKU: o.productoSku || '',
      cantidad: o.cantidad,
      precioUnitario: precioUnitario,
      total: total,
      cliente: o.cliente || '',
      canal: o.canal || 'produccion',
      metodoPago: o.metodoPago || '',
      origen: 'produccion',
      origenDetalle: 'Orden de Producción'
    });
  });
  
  // Ordenar por fecha descendente
  ventas.sort(function(a, b) {
    return (b.fecha || '').localeCompare(a.fecha || '');
  });
  
  return ventas;
}

/**
 * Renderiza el registro de ventas con filtros aplicados
 */
function renderRegistroVentas() {
  var ventas = obtenerVentasConsolidadas();
  
  // Obtener elementos de filtro (pueden no existir en otras páginas)
  var filtroDesde = document.getElementById('filtro-venta-desde');
  var filtroHasta = document.getElementById('filtro-venta-hasta');
  var filtroCanal = document.getElementById('filtro-venta-canal');
  var filtroMetodo = document.getElementById('filtro-venta-metodo');
  
  // Aplicar filtros
  var desde = filtroDesde ? filtroDesde.value : '';
  var hasta = filtroHasta ? filtroHasta.value : '';
  var canal = filtroCanal ? filtroCanal.value : '';
  var metodo = filtroMetodo ? filtroMetodo.value : '';
  
  if (desde) {
    ventas = ventas.filter(function(v) { return v.fecha >= desde; });
  }
  if (hasta) {
    ventas = ventas.filter(function(v) { return v.fecha <= hasta; });
  }
  if (canal) {
    ventas = ventas.filter(function(v) { return v.canal === canal; });
  }
  if (metodo) {
    ventas = ventas.filter(function(v) { return v.metodoPago === metodo; });
  }
  
  // Actualizar badge
  var badge = document.getElementById('badge-ventas');
  if (badge) {
    badge.textContent = ventas.length + (ventas.length === 1 ? ' venta' : ' ventas');
  }
  
  // Calcular resumen
  var totalUnidades = 0;
  var totalMonto = 0;
  var canales = {};
  var metodos = {};
  
  ventas.forEach(function(v) {
    totalUnidades += v.cantidad || 0;
    totalMonto += v.total || 0;
    
    var canalKey = v.canal || 'sin_canal';
    canales[canalKey] = (canales[canalKey] || 0) + 1;
    
    var metodoKey = v.metodoPago || 'sin_metodo';
    metodos[metodoKey] = (metodos[metodoKey] || 0) + 1;
  });
  
  // Renderizar resumen
  var resumenEl = document.getElementById('resumen-ventas');
  if (resumenEl) {
    var resumenHtml = '';
    resumenHtml += '<div class="kpi-mini"><div class="kpi-valor">' + ventas.length + '</div><div class="kpi-label">Ventas</div></div>';
    resumenHtml += '<div class="kpi-mini"><div class="kpi-valor">' + _formatNumRV(totalUnidades) + '</div><div class="kpi-label">Unidades</div></div>';
    resumenHtml += '<div class="kpi-mini"><div class="kpi-valor">$' + _formatNumRV(totalMonto) + '</div><div class="kpi-label">Total</div></div>';
    
    // Top canal
    var topCanal = Object.keys(canales).sort(function(a,b) { return canales[b] - canales[a]; })[0];
    if (topCanal && topCanal !== 'sin_canal') {
      resumenHtml += '<div class="kpi-mini"><div class="kpi-valor">' + _formatearCanal(topCanal) + '</div><div class="kpi-label">Canal principal</div></div>';
    }
    
    resumenEl.innerHTML = resumenHtml;
  }
  
  // Renderizar tabla
  var wrapper = document.getElementById('tabla-registro-ventas');
  if (!wrapper) return;
  
  if (ventas.length === 0) {
    wrapper.innerHTML = '<p class="tabla-vacia">No hay ventas registradas con los filtros seleccionados.</p>';
    return;
  }
  
  var filas = ventas.slice(0, 100).map(function(v) {
    var fechaFormateada = v.fecha ? _formatearFechaCorta(v.fecha) : '—';
    var canalTag = v.canal ? '<span class="tag-canal tag-' + v.canal + '">' + _formatearCanal(v.canal) + '</span>' : '';
    var metodoTag = v.metodoPago ? '<span class="tag-metodo">' + _formatearMetodo(v.metodoPago) + '</span>' : '';
    var origenTag = v.origen === 'produccion' 
      ? '<span class="tag-origen tag-produccion">OP</span>' 
      : '<span class="tag-origen tag-importacion">IMP</span>';
    
    return '<tr>' +
      '<td>' + fechaFormateada + '</td>' +
      '<td>' + _escaparRV(v.numeroOrden || '—') + '</td>' +
      '<td>' + (v.productoSKU ? '<span class="sku-tag">' + _escaparRV(v.productoSKU) + '</span> ' : '') + _escaparRV(v.productoNombre) + '</td>' +
      '<td class="td-num">' + _formatNumRV(v.cantidad) + '</td>' +
      '<td class="td-num">$' + _formatNumRV(v.total) + '</td>' +
      '<td>' + _escaparRV(v.cliente || '—') + '</td>' +
      '<td>' + canalTag + '</td>' +
      '<td>' + metodoTag + '</td>' +
      '<td>' + origenTag + '</td>' +
      '</tr>';
  }).join('');
  
  wrapper.innerHTML = '<table class="tabla tabla-ventas">' +
    '<thead><tr>' +
    '<th>Fecha</th><th>N° Orden</th><th>Producto</th><th class="td-num">Cant.</th>' +
    '<th class="td-num">Total</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Origen</th>' +
    '</tr></thead>' +
    '<tbody>' + filas + '</tbody>' +
    '</table>' +
    (ventas.length > 100 ? '<p style="color:var(--text-3);font-size:0.8rem;margin-top:0.5rem;">Mostrando las primeras 100 ventas.</p>' : '');
}

/**
 * Limpia todos los filtros del registro de ventas
 */
function limpiarFiltrosVentas() {
  var filtroDesde = document.getElementById('filtro-venta-desde');
  var filtroHasta = document.getElementById('filtro-venta-hasta');
  var filtroCanal = document.getElementById('filtro-venta-canal');
  var filtroMetodo = document.getElementById('filtro-venta-metodo');
  
  if (filtroDesde) filtroDesde.value = '';
  if (filtroHasta) filtroHasta.value = '';
  if (filtroCanal) filtroCanal.value = '';
  if (filtroMetodo) filtroMetodo.value = '';
  
  renderRegistroVentas();
}

/**
 * Obtiene estadísticas de ventas por canal
 */
function obtenerEstadisticasPorCanal() {
  var ventas = obtenerVentasConsolidadas();
  var estadisticas = {};
  
  ventas.forEach(function(v) {
    var canal = v.canal || 'sin_canal';
    if (!estadisticas[canal]) {
      estadisticas[canal] = {
        canal: canal,
        nombre: _formatearCanal(canal),
        cantidadVentas: 0,
        unidades: 0,
        total: 0
      };
    }
    estadisticas[canal].cantidadVentas++;
    estadisticas[canal].unidades += v.cantidad || 0;
    estadisticas[canal].total += v.total || 0;
  });
  
  return Object.values(estadisticas).sort(function(a, b) {
    return b.total - a.total;
  });
}

/**
 * Obtiene estadísticas de ventas por método de pago
 */
function obtenerEstadisticasPorMetodoPago() {
  var ventas = obtenerVentasConsolidadas();
  var estadisticas = {};
  
  ventas.forEach(function(v) {
    var metodo = v.metodoPago || 'sin_metodo';
    if (!estadisticas[metodo]) {
      estadisticas[metodo] = {
        metodo: metodo,
        nombre: _formatearMetodo(metodo),
        cantidadVentas: 0,
        unidades: 0,
        total: 0
      };
    }
    estadisticas[metodo].cantidadVentas++;
    estadisticas[metodo].unidades += v.cantidad || 0;
    estadisticas[metodo].total += v.total || 0;
  });
  
  return Object.values(estadisticas).sort(function(a, b) {
    return b.total - a.total;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS (con prefijo para evitar colisiones)
// ══════════════════════════════════════════════════════════════════════════════

function _formatearCanal(canal) {
  var nombres = {
    'tiendanube': 'TiendaNube',
    'tiendanegocio': 'TiendaNegocio',
    'mercadolibre': 'MercadoLibre',
    'whatsapp': 'WhatsApp',
    'presencial': 'Presencial',
    'distribuidor': 'Distribuidor',
    'produccion': 'Producción',
    'importacion': 'Importación',
    'otro': 'Otro',
    'sin_canal': 'Sin canal'
  };
  return nombres[canal] || canal;
}

function _formatearMetodo(metodo) {
  var nombres = {
    'transferencia': 'Transferencia',
    'mercadopago': 'MercadoPago',
    'credito': 'Crédito',
    'efectivo': 'Efectivo',
    'otra': 'Otra',
    'sin_metodo': 'Sin especificar'
  };
  return nombres[metodo] || metodo;
}

function _formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '—';
  var partes = fechaISO.split('-');
  if (partes.length !== 3) return fechaISO;
  return partes[2] + '/' + partes[1] + '/' + partes[0].slice(2);
}

function _formatNumRV(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _escaparRV(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Inicializa el registro de ventas
 * Se llama automáticamente cuando el DOM está listo
 */
function initRegistroVentas() {
  // Solo renderizar si existe el contenedor
  if (document.getElementById('tabla-registro-ventas')) {
    renderRegistroVentas();
  }
}

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Esperar a que AppData esté listo (se carga en app.js)
  setTimeout(function() {
    if (window.AppData) {
      initRegistroVentas();
    }
  }, 150);
});
