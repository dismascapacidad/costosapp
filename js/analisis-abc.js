/**
 * analisis-abc.js
 * Clasificación ABC de productos según ventas (Pareto 80/20)
 */

/**
 * Calcula el análisis ABC de productos
 * @returns {Object} Análisis completo con productos clasificados
 */
function calcularAnalisisABC() {
  if (!window.AppData.ventas || window.AppData.ventas.length === 0) {
    return {
      disponible: false,
      mensaje: 'No hay ventas importadas todavía.',
      productos: [],
      claseA: [],
      claseB: [],
      claseC: []
    };
  }

  // Agrupar ventas por producto
  var ventasPorProducto = {};
  window.AppData.ventas.forEach(function(v) {
    if (!ventasPorProducto[v.productoId]) {
      ventasPorProducto[v.productoId] = {
        productoId: v.productoId,
        productoNombre: v.productoNombre,
        productoSKU: v.productoSKU,
        cantidadVentas: 0,
        unidadesVendidas: 0,
        ingresoTotal: 0
      };
    }
    ventasPorProducto[v.productoId].cantidadVentas++;
    ventasPorProducto[v.productoId].unidadesVendidas += v.cantidad;
    ventasPorProducto[v.productoId].ingresoTotal += v.total;
  });

  // Convertir a array y ordenar por ingreso descendente
  var productos = Object.values(ventasPorProducto)
    .sort(function(a, b) { return b.ingresoTotal - a.ingresoTotal; });

  // Calcular total de ingresos
  var ingresoTotal = productos.reduce(function(sum, p) {
    return sum + p.ingresoTotal;
  }, 0);

  // Calcular porcentajes acumulados y clasificar
  var acumulado = 0;
  var claseA = [];
  var claseB = [];
  var claseC = [];

  productos.forEach(function(p) {
    p.porcentajeIngreso = (p.ingresoTotal / ingresoTotal) * 100;
    acumulado += p.porcentajeIngreso;
    p.porcentajeAcumulado = acumulado;

    // Clasificación ABC según criterio de Pareto
    if (acumulado <= 80) {
      p.clase = 'A';
      claseA.push(p);
    } else if (acumulado <= 95) {
      p.clase = 'B';
      claseB.push(p);
    } else {
      p.clase = 'C';
      claseC.push(p);
    }
  });

  // Calcular estadísticas por clase
  var statsA = calcularStatsClase(claseA, ingresoTotal);
  var statsB = calcularStatsClase(claseB, ingresoTotal);
  var statsC = calcularStatsClase(claseC, ingresoTotal);

  return {
    disponible: true,
    productos: productos,
    claseA: claseA,
    claseB: claseB,
    claseC: claseC,
    statsA: statsA,
    statsB: statsB,
    statsC: statsC,
    ingresoTotal: ingresoTotal,
    totalProductos: productos.length
  };
}

/**
 * Calcula estadísticas de una clase
 */
function calcularStatsClase(productos, ingresoTotal) {
  if (productos.length === 0) {
    return {
      cantidad: 0,
      porcentajeProductos: 0,
      ingresoTotal: 0,
      porcentajeIngreso: 0
    };
  }

  var ingreso = productos.reduce(function(sum, p) {
    return sum + p.ingresoTotal;
  }, 0);

  return {
    cantidad: productos.length,
    ingresoTotal: ingreso,
    porcentajeIngreso: (ingreso / ingresoTotal) * 100
  };
}

/**
 * Obtiene recomendaciones específicas por clase
 */
function obtenerRecomendacionesABC(analisis) {
  var recomendaciones = {
    claseA: [],
    claseB: [],
    claseC: [],
    alertas: []
  };

  if (!analisis.disponible) return recomendaciones;

  // Recomendaciones Clase A (críticos)
  recomendaciones.claseA.push({
    tipo: 'stock',
    titulo: 'Mantener stock óptimo',
    descripcion: 'Estos productos generan el 80% de tus ingresos. Nunca te quedes sin stock.'
  });
  recomendaciones.claseA.push({
    tipo: 'precio',
    titulo: 'Oportunidad de ajuste de precio',
    descripcion: 'Probá subir precios 5-10%. Si la demanda es inelástica, ganarás más sin perder ventas.'
  });
  recomendaciones.claseA.push({
    tipo: 'calidad',
    titulo: 'Máxima calidad',
    descripcion: 'Invertí en mejorar estos productos. Son tu motor de ingresos.'
  });

  // Recomendaciones Clase B (importantes)
  recomendaciones.claseB.push({
    tipo: 'crecimiento',
    titulo: 'Potencial de crecimiento',
    descripcion: 'Estos productos tienen potencial. Considerá promocionarlos para llevarlos a Clase A.'
  });
  recomendaciones.claseB.push({
    tipo: 'eficiencia',
    titulo: 'Optimizar procesos',
    descripcion: 'Buscá formas de reducir costos de producción sin afectar calidad.'
  });

  // Recomendaciones Clase C (revisar)
  recomendaciones.claseC.push({
    tipo: 'revision',
    titulo: 'Revisar viabilidad',
    descripcion: 'Estos productos generan poco ingreso. Evaluá si vale la pena mantenerlos.'
  });
  recomendaciones.claseC.push({
    tipo: 'simplificar',
    titulo: 'Simplificar catálogo',
    descripcion: 'Considerá eliminar productos C con bajo margen. Liberarás tiempo y recursos.'
  });

  // Detectar alertas específicas
  analisis.claseA.forEach(function(p) {
    // Buscar el producto en CostosApp para obtener margen
    var producto = window.AppData.productos.find(function(prod) {
      return prod.id === p.productoId;
    });
    
    if (producto) {
      try {
        var resumen = calcularResumen(producto, window.AppData.insumos);
        
        // Alerta: Clase A con margen bajo
        if (resumen.margenConsumidor < 40) {
          recomendaciones.alertas.push({
            tipo: 'critico',
            producto: p.productoNombre,
            mensaje: 'Producto Clase A con margen bajo (' + formatNum(resumen.margenConsumidor) + '%). ¡OPTIMIZAR URGENTE!',
            accion: 'Subir precio o reducir costos inmediatamente.'
          });
        }
      } catch(e) {}
    }
  });

  return recomendaciones;
}

/**
 * Renderiza el panel de análisis ABC en estadísticas
 */
function renderAnalisisABC() {
  var analisis = calcularAnalisisABC();
  var container = document.getElementById('analisis-abc-container');
  
  if (!container) return;

  if (!analisis.disponible) {
    container.innerHTML = 
      '<div class="estado-vacio">' +
      '<span class="estado-vacio-icono">📊</span>' +
      '<p>No hay datos de ventas para análisis ABC</p>' +
      '<p style="font-size:0.875rem;color:var(--text-3);margin-top:0.5rem;">' +
      'Importá ventas desde TiendaNube para activar este análisis.' +
      '</p>' +
      '<a href="importar-ventas.html" class="btn btn-primary" style="margin-top:1rem;">Importar ventas →</a>' +
      '</div>';
    return;
  }

  var html = '';

  // Resumen ejecutivo por clase
  html += '<div class="abc-resumen">';
  html += renderClaseCard('A', analisis.statsA, analisis.totalProductos, '#22c55e');
  html += renderClaseCard('B', analisis.statsB, analisis.totalProductos, '#fbbf24');
  html += renderClaseCard('C', analisis.statsC, analisis.totalProductos, '#ef4444');
  html += '</div>';

  // Gráfico de barras
  html += '<div class="card" style="margin-top:1.5rem;">';
  html += '<div class="card-header"><h3>Distribución de Ingresos por Producto</h3></div>';
  html += '<div class="card-body"><canvas id="chart-abc" style="max-height:400px;"></canvas></div>';
  html += '</div>';

  // Tabla detallada por clase
  html += '<div class="card" style="margin-top:1.5rem;">';
  html += '<div class="card-header">';
  html += '<h3>Detalle por Clase</h3>';
  html += '<div class="tabs-abc">';
  html += '<button class="tab-abc active" onclick="mostrarTablaClase(\'A\')">Clase A</button>';
  html += '<button class="tab-abc" onclick="mostrarTablaClase(\'B\')">Clase B</button>';
  html += '<button class="tab-abc" onclick="mostrarTablaClase(\'C\')">Clase C</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="card-body">';
  html += '<div id="tabla-clase-A" class="tabla-clase" style="display:block;">' + renderTablaClase(analisis.claseA) + '</div>';
  html += '<div id="tabla-clase-B" class="tabla-clase" style="display:none;">' + renderTablaClase(analisis.claseB) + '</div>';
  html += '<div id="tabla-clase-C" class="tabla-clase" style="display:none;">' + renderTablaClase(analisis.claseC) + '</div>';
  html += '</div>';
  html += '</div>';

  // Recomendaciones
  var recomendaciones = obtenerRecomendacionesABC(analisis);
  if (recomendaciones.alertas.length > 0) {
    html += '<div class="card" style="margin-top:1.5rem;">';
    html += '<div class="card-header"><h3>⚠️ Alertas Críticas</h3></div>';
    html += '<div class="card-body">';
    recomendaciones.alertas.forEach(function(alerta) {
      html += '<div class="alerta-abc alerta-' + alerta.tipo + '">';
      html += '<div class="alerta-titulo"><strong>' + escapar(alerta.producto) + '</strong></div>';
      html += '<div class="alerta-mensaje">' + alerta.mensaje + '</div>';
      html += '<div class="alerta-accion">💡 ' + alerta.accion + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  html += '<div class="card" style="margin-top:1.5rem;">';
  html += '<div class="card-header"><h3>💡 Recomendaciones por Clase</h3></div>';
  html += '<div class="card-body">';
  html += '<div class="recomendaciones-grid">';
  
  html += '<div class="recomendacion-seccion">';
  html += '<h4 style="color:#22c55e;">Clase A - Prioridad Máxima</h4>';
  recomendaciones.claseA.forEach(function(r) {
    html += '<div class="recomendacion-item">';
    html += '<div class="rec-titulo">' + r.titulo + '</div>';
    html += '<div class="rec-desc">' + r.descripcion + '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="recomendacion-seccion">';
  html += '<h4 style="color:#fbbf24;">Clase B - Optimizar</h4>';
  recomendaciones.claseB.forEach(function(r) {
    html += '<div class="recomendacion-item">';
    html += '<div class="rec-titulo">' + r.titulo + '</div>';
    html += '<div class="rec-desc">' + r.descripcion + '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="recomendacion-seccion">';
  html += '<h4 style="color:#ef4444;">Clase C - Revisar</h4>';
  recomendaciones.claseC.forEach(function(r) {
    html += '<div class="recomendacion-item">';
    html += '<div class="rec-titulo">' + r.titulo + '</div>';
    html += '<div class="rec-desc">' + r.descripcion + '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  // Renderizar gráfico
  if (analisis.productos.length > 0) {
    renderGraficoABC(analisis);
  }
}

/**
 * Renderiza una card de clase
 */
function renderClaseCard(clase, stats, totalProductos, color) {
  var porcentajeProductos = totalProductos > 0 ? (stats.cantidad / totalProductos * 100) : 0;
  
  return '<div class="clase-card clase-' + clase + '">' +
    '<div class="clase-header">' +
    '<span class="clase-badge" style="background:' + color + ';">Clase ' + clase + '</span>' +
    '<span class="clase-productos">' + stats.cantidad + ' productos</span>' +
    '</div>' +
    '<div class="clase-stats">' +
    '<div class="clase-stat">' +
    '<span class="stat-label">% de Productos</span>' +
    '<span class="stat-value">' + formatNum(porcentajeProductos) + '%</span>' +
    '</div>' +
    '<div class="clase-stat">' +
    '<span class="stat-label">% de Ingresos</span>' +
    '<span class="stat-value">' + formatNum(stats.porcentajeIngreso) + '%</span>' +
    '</div>' +
    '<div class="clase-stat">' +
    '<span class="stat-label">Ingreso Total</span>' +
    '<span class="stat-value">ARS ' + formatNum(stats.ingresoTotal) + '</span>' +
    '</div>' +
    '</div>' +
    '</div>';
}

/**
 * Renderiza tabla de productos de una clase
 */
function renderTablaClase(productos) {
  if (productos.length === 0) {
    return '<p class="tabla-vacia">No hay productos en esta clase.</p>';
  }

  var html = '<table class="tabla">';
  html += '<thead><tr>';
  html += '<th>SKU</th><th>Producto</th>';
  html += '<th class="td-num">Ventas</th><th class="td-num">Unidades</th>';
  html += '<th class="td-num">Ingreso Total</th><th class="td-num">% del Total</th>';
  html += '<th class="td-num">% Acumulado</th>';
  html += '</tr></thead><tbody>';

  productos.forEach(function(p) {
    html += '<tr>';
    html += '<td>' + (p.productoSKU ? '<span class="sku-tag">' + escapar(p.productoSKU) + '</span>' : '-') + '</td>';
    html += '<td>' + escapar(p.productoNombre) + '</td>';
    html += '<td class="td-num">' + p.cantidadVentas + '</td>';
    html += '<td class="td-num">' + formatNum(p.unidadesVendidas) + '</td>';
    html += '<td class="td-num td-costo">ARS ' + formatNum(p.ingresoTotal) + '</td>';
    html += '<td class="td-num">' + formatNum(p.porcentajeIngreso) + '%</td>';
    html += '<td class="td-num">' + formatNum(p.porcentajeAcumulado) + '%</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

/**
 * Muestra la tabla de una clase específica
 */
function mostrarTablaClase(clase) {
  // Ocultar todas
  document.querySelectorAll('.tabla-clase').forEach(function(el) {
    el.style.display = 'none';
  });
  // Mostrar la seleccionada
  var tabla = document.getElementById('tabla-clase-' + clase);
  if (tabla) tabla.style.display = 'block';

  // Actualizar tabs
  document.querySelectorAll('.tab-abc').forEach(function(el) {
    el.classList.remove('active');
  });
  event.target.classList.add('active');
}

// Helpers
function formatNum(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapar(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
