/**
 * estadisticas-charts.js
 * Configuración y renderizado de gráficos con Chart.js
 */

// Instancia global del gráfico para poder actualizarlo
var _chartTopProductos = null;

/**
 * Renderiza el gráfico de barras horizontales con los top 10 productos
 * @param {Array} productos - Array de productos con datos de rentabilidad
 */
function renderGraficoTopProductos(productos) {
  if (productos.length === 0) return;

  // Ordenar por margen y tomar top 10
  var top10 = productos
    .slice()
    .sort(function(a, b) { return b.margenPorcentaje - a.margenPorcentaje; })
    .slice(0, 10);

  // Preparar datos para Chart.js
  var labels = top10.map(function(p) { return p.nombre; });
  var data = top10.map(function(p) { return p.margenPorcentaje; });
  var colores = top10.map(function(p) { return getColorMargen(p.margenPorcentaje); });

  var ctx = document.getElementById('chart-top-productos');
  
  // Si ya existe un gráfico, destruirlo antes de crear uno nuevo
  if (_chartTopProductos) {
    _chartTopProductos.destroy();
  }

  _chartTopProductos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Margen %',
        data: data,
        backgroundColor: colores,
        borderColor: colores.map(function(c) { return c.replace('0.7', '1'); }),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y', // Barras horizontales
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              return 'Margen: ' + context.parsed.x.toFixed(2) + '%';
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            font: {
              size: 12
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        y: {
          ticks: {
            font: {
              size: 12
            }
          },
          grid: {
            display: false
          }
        }
      },
      layout: {
        padding: {
          right: 20
        }
      }
    }
  });
}

/**
 * Retorna el color correspondiente según el margen
 * @param {number} margen - Porcentaje de margen
 * @returns {string} Color RGBA
 */
function getColorMargen(margen) {
  if (margen >= 50) return 'rgba(34, 197, 94, 0.7)';  // Verde
  if (margen >= 40) return 'rgba(251, 191, 36, 0.7)'; // Amarillo
  return 'rgba(239, 68, 68, 0.7)';                    // Rojo
}

/**
 * Actualiza el gráfico con nuevos datos (útil para futuras funcionalidades de filtrado)
 * @param {Array} productos - Nuevos datos de productos
 */
function actualizarGrafico(productos) {
  renderGraficoTopProductos(productos);
}
