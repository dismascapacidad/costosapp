/**
 * estadisticas.js
 * Módulo de análisis de rentabilidad de productos
 * Calcula métricas, genera tablas y coordina visualizaciones
 */

// Variable global para tracking del orden de la tabla
var _ordenActual = { campo: 'margen', direccion: 'desc' };

/**
 * Inicializa el módulo de estadísticas
 * Llamado desde app.js cuando la página carga
 */
function initEstadisticas() {
  console.log('[estadisticas] Inicializando módulo...');
  
  if (!window.AppData || !window.AppData.productos || !window.AppData.insumos) {
    console.error('[estadisticas] AppData no disponible');
    return;
  }

  cargarEstadisticas();
}

/**
 * Carga y renderiza todas las estadísticas
 */
function cargarEstadisticas() {
  var analisis = calcularAnalisisRentabilidad();
  
  if (analisis.productos.length === 0) {
    mostrarMensajeSinProductos();
    return;
  }

  renderResumenEjecutivo(analisis);
  renderTablaRentabilidad(analisis.productos);
  renderGraficoTopProductos(analisis.productos);
  
  // Cargar análisis ABC después de un pequeño delay
  // para asegurar que AppData.ventas esté completamente cargado
  setTimeout(function() {
    cargarAnalisisABC();
  }, 100);
}

/**
 * Carga y renderiza el análisis ABC de ventas
 */
function cargarAnalisisABC() {
  var analisisABC = calcularAnalisisABC();
  
  if (!analisisABC.disponible) {
    // No hay ventas - mostrar mensaje
    document.getElementById('seccion-abc').style.display = 'none';
    document.getElementById('mensaje-sin-ventas').style.display = 'block';
    return;
  }
  
  // Hay ventas - mostrar análisis ABC
  document.getElementById('seccion-abc').style.display = 'block';
  document.getElementById('mensaje-sin-ventas').style.display = 'none';
  
  renderResumenABC(analisisABC);
  renderTablaABC(analisisABC.productos);
  renderGraficoABC(analisisABC);
}

/**
 * Renderiza el resumen de clasificación ABC
 */
function renderResumenABC(analisis) {
  // Clase A
  document.getElementById('abc-a-productos').textContent = analisis.statsA.cantidad;
  document.getElementById('abc-a-ingresos').textContent = 'ARS ' + formatNum(analisis.statsA.ingresoTotal);
  
  // Clase B
  document.getElementById('abc-b-productos').textContent = analisis.statsB.cantidad;
  document.getElementById('abc-b-ingresos').textContent = 'ARS ' + formatNum(analisis.statsB.ingresoTotal);
  
  // Clase C
  document.getElementById('abc-c-productos').textContent = analisis.statsC.cantidad;
  document.getElementById('abc-c-ingresos').textContent = 'ARS ' + formatNum(analisis.statsC.ingresoTotal);
}

/**
 * Renderiza la tabla de productos ABC
 */
var _filtroClaseActual = 'todos';

function renderTablaABC(productos) {
  var wrapper = document.getElementById('tabla-abc-wrapper');
  
  if (!productos || productos.length === 0) {
    wrapper.innerHTML = '<p class="tabla-vacia">No hay datos de ventas.</p>';
    return;
  }
  
  // Filtrar según clase seleccionada
  var productosFiltrados = _filtroClaseActual === 'todos' 
    ? productos 
    : productos.filter(function(p) { return p.clase === _filtroClaseActual; });
  
  if (productosFiltrados.length === 0) {
    wrapper.innerHTML = '<p class="tabla-vacia">No hay productos en esta clase.</p>';
    return;
  }
  
  var filas = productosFiltrados.map(function(p) {
    var claseColor = 'abc-badge-' + p.clase.toLowerCase();
    var claseBadge = '<span class="abc-badge ' + claseColor + '">Clase ' + p.clase + '</span>';
    
    return '<tr>' +
      '<td>' + claseBadge + '</td>' +
      '<td><span class="sku-tag">' + escapar(p.productoSKU || '-') + '</span></td>' +
      '<td>' + escapar(p.productoNombre) + '</td>' +
      '<td class="td-num">' + p.unidadesVendidas + '</td>' +
      '<td class="td-num">ARS ' + formatNum(p.ingresoTotal) + '</td>' +
      '<td class="td-num">' + p.porcentajeIngreso.toFixed(1) + '%</td>' +
      '<td class="td-num">' + p.porcentajeAcumulado.toFixed(1) + '%</td>' +
    '</tr>';
  }).join('');
  
  wrapper.innerHTML = 
    '<table class="tabla tabla-abc">' +
      '<thead><tr>' +
        '<th>Clase</th>' +
        '<th>SKU</th>' +
        '<th>Producto</th>' +
        '<th class="td-num">Unidades Vendidas</th>' +
        '<th class="td-num">Ingresos Totales</th>' +
        '<th class="td-num">% Ingresos</th>' +
        '<th class="td-num">% Acumulado</th>' +
      '</tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
    '</table>';
}

/**
 * Filtra la tabla ABC por clase
 */
function filtrarClaseABC(clase) {
  _filtroClaseActual = clase;
  
  var analisisABC = calcularAnalisisABC();
  if (analisisABC.disponible) {
    renderTablaABC(analisisABC.productos);
  }
}

/**
 * Renderiza el gráfico de Pareto ABC
 */
var _chartABC = null; // Variable global para el gráfico ABC

function renderGraficoABC(analisis) {
  var ctx = document.getElementById('chart-abc-pareto');
  if (!ctx) return;
  
  // Destruir gráfico anterior si existe
  if (_chartABC) {
    _chartABC.destroy();
    _chartABC = null;
  }
  
  // Tomar máximo 20 productos para el gráfico
  var productos = analisis.productos.slice(0, 20);
  
  var labels = productos.map(function(p) {
    return p.productoSKU || p.productoNombre.substring(0, 15);
  });
  
  var ingresos = productos.map(function(p) { return p.ingresoTotal; });
  var porcentajesAcum = productos.map(function(p) { return p.porcentajeAcumulado; });
  
  // Colores según clase
  var coloresBarras = productos.map(function(p) {
    if (p.clase === 'A') return 'rgba(34, 197, 94, 0.8)';
    if (p.clase === 'B') return 'rgba(234, 179, 8, 0.8)';
    return 'rgba(239, 68, 68, 0.8)';
  });
  
  _chartABC = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos (ARS)',
          data: ingresos,
          backgroundColor: coloresBarras,
          borderColor: coloresBarras.map(function(c) { return c.replace('0.8', '1'); }),
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: '% Acumulado',
          data: porcentajesAcum,
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          fill: false,
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#e8eaf0', font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var label = context.dataset.label || '';
              if (context.parsed.y !== null) {
                if (context.datasetIndex === 0) {
                  label += ': ARS ' + formatNum(context.parsed.y);
                } else {
                  label += ': ' + context.parsed.y.toFixed(1) + '%';
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8b90a0', maxRotation: 45, minRotation: 45 },
          grid: { color: '#2a2e38' }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            color: '#8b90a0',
            callback: function(value) { return 'ARS ' + formatNum(value); }
          },
          grid: { color: '#2a2e38' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          ticks: {
            color: '#f59e0b',
            callback: function(value) { return value + '%'; }
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}


/**
 * Calcula el análisis completo de rentabilidad para todos los productos
 * @returns {Object} Objeto con métricas y array de productos analizados
 */
function calcularAnalisisRentabilidad() {
  var productos = window.AppData.productos;
  var insumos = window.AppData.insumos;
  var productosConRentabilidad = [];

  // Calcular rentabilidad de cada producto
  productos.forEach(function(p) {
    try {
      var resumen = calcularResumen(p, insumos);
      
      productosConRentabilidad.push({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku || '-',
        categoria: p.categoria || 'Sin categoría',
        costoTotal: resumen.costoTotal,
        precioFinal: resumen.precioFinal,
        margenPorcentaje: resumen.margenConsumidor,
        ganancia: resumen.ganancia,
        precioDistribuidor: resumen.precioDistribuidor,
        margenDistribuidor: resumen.margenDistribuidor
      });
    } catch (err) {
      console.warn('[estadisticas] Error calculando producto:', p.nombre, err);
    }
  });

  // Calcular métricas globales
  var totalProductos = productosConRentabilidad.length;
  var margenPromedio = 0;
  
  if (totalProductos > 0) {
    var sumaMargen = productosConRentabilidad.reduce(function(sum, p) {
      return sum + p.margenPorcentaje;
    }, 0);
    margenPromedio = sumaMargen / totalProductos;
  }

  // Ordenar por margen para encontrar extremos
  var ordenados = productosConRentabilidad.slice().sort(function(a, b) {
    return b.margenPorcentaje - a.margenPorcentaje;
  });

  return {
    totalProductos: totalProductos,
    margenPromedio: margenPromedio,
    productoMasRentable: ordenados[0] || null,
    productoMenosRentable: ordenados[ordenados.length - 1] || null,
    productos: productosConRentabilidad
  };
}

/**
 * Renderiza el panel de resumen ejecutivo
 * @param {Object} analisis - Datos del análisis de rentabilidad
 */
function renderResumenEjecutivo(analisis) {
  document.getElementById('total-productos').textContent = analisis.totalProductos;
  document.getElementById('margen-promedio').textContent = formatNum(analisis.margenPromedio) + '%';
  
  if (analisis.productoMasRentable) {
    document.getElementById('producto-top').textContent = analisis.productoMasRentable.nombre;
    document.getElementById('producto-top-margen').textContent = formatNum(analisis.productoMasRentable.margenPorcentaje) + '%';
  }
  
  if (analisis.productoMenosRentable) {
    document.getElementById('producto-bajo').textContent = analisis.productoMenosRentable.nombre;
    document.getElementById('producto-bajo-margen').textContent = formatNum(analisis.productoMenosRentable.margenPorcentaje) + '%';
  }
}

/**
 * Renderiza la tabla detallada de rentabilidad
 * @param {Array} productos - Array de productos con datos de rentabilidad
 */
function renderTablaRentabilidad(productos) {
  var wrapper = document.getElementById('tabla-rentabilidad-wrapper');
  
  if (productos.length === 0) {
    wrapper.innerHTML = '<p class="tabla-vacia">No hay productos con datos de rentabilidad.</p>';
    return;
  }

  // Ordenar productos según criterio actual
  var productosOrdenados = ordenarProductos(productos, _ordenActual.campo, _ordenActual.direccion);

  var table = document.createElement('table');
  table.className = 'tabla tabla-rentabilidad';
  table.innerHTML = 
    '<thead><tr>' +
    '<th class="col-sku">SKU</th>' +
    '<th class="col-producto">Producto</th>' +
    '<th class="col-categoria">Categoría</th>' +
    '<th class="td-num col-costo">Costo</th>' +
    '<th class="td-num col-precio">Precio</th>' +
    '<th class="td-num col-ganancia">Ganancia</th>' +
    '<th class="td-num col-margen">Margen %</th>' +
    '<th class="td-num col-indicador">Indicador</th>' +
    '</tr></thead>';

  var tbody = document.createElement('tbody');

  productosOrdenados.forEach(function(p) {
    var tr = document.createElement('tr');
    
    // Determinar clase de indicador según margen
    var indicadorClass = getClaseMargen(p.margenPorcentaje);
    var indicadorTexto = getTextoMargen(p.margenPorcentaje);

    tr.innerHTML = 
      '<td class="col-sku"><span class="sku-tag">' + escapar(p.sku) + '</span></td>' +
      '<td class="col-producto"><strong>' + escapar(p.nombre) + '</strong></td>' +
      '<td class="col-categoria">' + escapar(p.categoria) + '</td>' +
      '<td class="td-num col-costo">ARS ' + formatNum(p.costoTotal) + '</td>' +
      '<td class="td-num col-precio">ARS ' + formatNum(p.precioFinal) + '</td>' +
      '<td class="td-num col-ganancia">ARS ' + formatNum(p.ganancia) + '</td>' +
      '<td class="td-num col-margen"><strong>' + formatNum(p.margenPorcentaje) + '%</strong></td>' +
      '<td class="td-num col-indicador"><span class="badge-margen ' + indicadorClass + '">' + indicadorTexto + '</span></td>';

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrapper.innerHTML = '';
  wrapper.appendChild(table);
}

/**
 * Ordena productos según campo y dirección especificados
 * @param {Array} productos - Array de productos
 * @param {string} campo - Campo por el que ordenar (nombre|margen|ganancia)
 * @param {string} direccion - Dirección del orden (asc|desc)
 * @returns {Array} Productos ordenados
 */
function ordenarProductos(productos, campo, direccion) {
  var copia = productos.slice();
  
  copia.sort(function(a, b) {
    var valorA, valorB;
    
    switch(campo) {
      case 'nombre':
        valorA = a.nombre.toLowerCase();
        valorB = b.nombre.toLowerCase();
        return direccion === 'asc' 
          ? valorA.localeCompare(valorB, 'es')
          : valorB.localeCompare(valorA, 'es');
      
      case 'margen':
        valorA = a.margenPorcentaje;
        valorB = b.margenPorcentaje;
        break;
      
      case 'ganancia':
        valorA = a.ganancia;
        valorB = b.ganancia;
        break;
      
      default:
        return 0;
    }
    
    return direccion === 'asc' ? valorA - valorB : valorB - valorA;
  });
  
  return copia;
}

/**
 * Maneja el ordenamiento de la tabla desde los botones
 * @param {string} campo - Campo por el que ordenar
 */
function ordenarTabla(campo) {
  // Si se clickea el mismo campo, invertir dirección
  if (_ordenActual.campo === campo) {
    _ordenActual.direccion = _ordenActual.direccion === 'asc' ? 'desc' : 'asc';
  } else {
    _ordenActual.campo = campo;
    _ordenActual.direccion = campo === 'nombre' ? 'asc' : 'desc'; // nombres ascendente, números descendente
  }
  
  var analisis = calcularAnalisisRentabilidad();
  renderTablaRentabilidad(analisis.productos);
}

/**
 * Determina la clase CSS según el margen
 * @param {number} margen - Porcentaje de margen
 * @returns {string} Clase CSS
 */
function getClaseMargen(margen) {
  if (margen >= 50) return 'margen-excelente';
  if (margen >= 40) return 'margen-aceptable';
  return 'margen-bajo';
}

/**
 * Determina el texto del badge según el margen
 * @param {number} margen - Porcentaje de margen
 * @returns {string} Texto descriptivo
 */
function getTextoMargen(margen) {
  if (margen >= 50) return 'Excelente';
  if (margen >= 40) return 'Aceptable';
  return 'Bajo';
}

/**
 * Muestra mensaje cuando no hay productos
 */
function mostrarMensajeSinProductos() {
  document.getElementById('total-productos').textContent = '0';
  document.getElementById('margen-promedio').textContent = '-';
  document.getElementById('producto-top').textContent = 'N/A';
  document.getElementById('producto-top-margen').textContent = '-';
  document.getElementById('producto-bajo').textContent = 'N/A';
  document.getElementById('producto-bajo-margen').textContent = '-';
  
  document.getElementById('tabla-rentabilidad-wrapper').innerHTML = 
    '<p class="tabla-vacia">No hay productos registrados. <a href="productos.html">Crea tu primer producto</a></p>';
}

// ---- Funciones auxiliares ----

/**
 * Formatea número con 2 decimales y separador de miles
 * @param {number} n - Número a formatear
 * @returns {string} Número formateado
 */
function formatNum(n) {
  return Number(n).toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} str - String a escapar
 * @returns {string} String escapado
 */
function escapar(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
