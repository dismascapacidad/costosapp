/**
 * estadisticas-charts.js — v2
 * Gráficos: Cuadrantes (bubble), Ingresos/mes (line),
 *           Métodos de pago (donut), ABC Pareto (bar+line)
 */

// Referencias globales para poder destruirlos al re-renderizar
var _chartCuadrantes  = null;
var _chartIngresosMes = null;
var _chartMetodosPago = null;
var _chartABC         = null;

// Paleta coherente con el tema oscuro de la app
var _CHART_COLORS = {
  grid:    '#2a2e38',
  text:    '#8b90a0',
  accent:  '#f59e0b',
  green:   '#22c55e',
  blue:    '#3b82f6',
  red:     '#ef4444',
  gray:    '#6b7280',
  surface: '#17191e'
};

// ── Gráfico de cuadrantes (bubble) ───────────────────────────────────────────

function renderGraficoCuadrantes(datos) {
  var canvas = document.getElementById('chart-cuadrantes');
  if (!canvas) return;

  if (_chartCuadrantes) { _chartCuadrantes.destroy(); _chartCuadrantes = null; }

  var items = datos.items.filter(function(p) { return p.tieneVentas && p.unidades > 0; });

  if (items.length === 0) {
    var wrap = document.getElementById('chart-cuadrantes-wrap');
    if (wrap) wrap.innerHTML = '<p class="tabla-vacia" style="padding:3rem 0">No hay productos con ventas para mostrar en el gráfico.<br><a href="importar-ventas.html">Importar ventas →</a></p>';
    var notaEl = document.getElementById('cuadrantes-nota');
    if (notaEl) notaEl.textContent = '';
    return;
  }

  // Umbrales: mediana de unidades + 45% de margen
  var uOrdenadas = items.map(function(p) { return p.unidades; }).sort(function(a, b) { return a - b; });
  var umbralUnidades = uOrdenadas[Math.floor(uOrdenadas.length / 2)];
  var umbralMargen   = 45;

  // Normalizar tamaño de burbuja por ingresos
  var maxIng = Math.max.apply(null, items.map(function(p) { return p.ingresos; }));

  function getCuadrante(p) {
    var altoM = p.margen   >= umbralMargen;
    var altoV = p.unidades >= umbralUnidades;
    if (altoM && altoV)  return 'estrella';
    if (altoM && !altoV) return 'oportunidad';
    if (!altoM && altoV) return 'riesgo';
    return 'revision';
  }

  var colorMap = {
    estrella:    { bg: 'rgba(34,197,94,0.75)',   border: '#22c55e' },
    oportunidad: { bg: 'rgba(59,130,246,0.75)',  border: '#3b82f6' },
    riesgo:      { bg: 'rgba(239,68,68,0.75)',   border: '#ef4444' },
    revision:    { bg: 'rgba(107,114,128,0.65)', border: '#9ca3af' }
  };

  var bubbles = items.map(function(p) {
    var q = getCuadrante(p);
    var r = Math.max(6, Math.min(36, 6 + 30 * Math.sqrt(p.ingresos / Math.max(maxIng, 1))));
    return {
      x: p.unidades,
      y: p.margen,
      r: r,
      _nom: p.nombre,
      _sku: p.sku,
      _ing: p.ingresos,
      _q:   q,
      _bg:  colorMap[q].bg,
      _bd:  colorMap[q].border
    };
  });

  // Plugin para líneas de cuadrante
  var pluginLineas = {
    id: 'cuadrante-lines',
    afterDraw: function(chart) {
      var ctx2   = chart.ctx;
      var xScale = chart.scales.x;
      var yScale = chart.scales.y;
      if (!xScale || !yScale) return;

      var xPx = xScale.getPixelForValue(umbralUnidades);
      var yPx = yScale.getPixelForValue(umbralMargen);
      var ca  = chart.chartArea;

      ctx2.save();
      ctx2.setLineDash([6, 4]);
      ctx2.strokeStyle = 'rgba(139,144,160,0.35)';
      ctx2.lineWidth = 1;

      // Línea vertical
      ctx2.beginPath();
      ctx2.moveTo(xPx, ca.top);
      ctx2.lineTo(xPx, ca.bottom);
      ctx2.stroke();

      // Línea horizontal
      ctx2.beginPath();
      ctx2.moveTo(ca.left, yPx);
      ctx2.lineTo(ca.right, yPx);
      ctx2.stroke();

      ctx2.restore();
    }
  };

  _chartCuadrantes = new Chart(canvas, {
    type: 'bubble',
    plugins: [pluginLineas],
    data: {
      datasets: [{
        label: 'Productos',
        data:  bubbles,
        backgroundColor: function(ctx) { var d = ctx.raw; return d ? d._bg : 'rgba(107,114,128,0.6)'; },
        borderColor:     function(ctx) { var d = ctx.raw; return d ? d._bd : '#9ca3af'; },
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var d = ctx.raw;
              if (!d) return '';
              var labels = {
                estrella: '⭐ Estrella', oportunidad: '🎯 Oportunidad',
                riesgo: '⚠️ Riesgo',    revision: '❌ Revisar'
              };
              return [
                (d._sku !== '—' ? '[' + d._sku + '] ' : '') + d._nom,
                'Margen: ' + Number(d.y).toFixed(1) + '%',
                'Unidades vendidas: ' + d.x,
                'Ingresos: ARS ' + Number(d._ing).toLocaleString('es-AR', { maximumFractionDigits: 0 }),
                labels[d._q] || d._q
              ];
            },
            title: function() { return ''; }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Unidades Vendidas', color: _CHART_COLORS.text, font: { size: 11 } },
          ticks: { color: _CHART_COLORS.text },
          grid:  { color: _CHART_COLORS.grid }
        },
        y: {
          title: { display: true, text: 'Margen %', color: _CHART_COLORS.text, font: { size: 11 } },
          ticks: { color: _CHART_COLORS.text, callback: function(v) { return v + '%'; } },
          grid:  { color: _CHART_COLORS.grid }
        }
      }
    }
  });

  // Nota debajo del gráfico
  var notaEl = document.getElementById('cuadrantes-nota');
  if (notaEl) {
    var sp = datos.productosSinVentas;
    var partes = ['Umbral margen: ' + umbralMargen + '%', 'Umbral volumen: ' + umbralUnidades + ' uds (mediana)'];
    if (sp > 0) partes.unshift(sp + ' producto' + (sp !== 1 ? 's' : '') + ' sin ventas no aparecen en el gráfico');
    notaEl.textContent = partes.join(' · ');
  }
}

// ── Ingresos por mes (line) ───────────────────────────────────────────────────

function renderGraficoIngresosMes(meses, mesesMap) {
  var canvas = document.getElementById('chart-ingresos-mes');
  if (!canvas) return;

  if (_chartIngresosMes) { _chartIngresosMes.destroy(); _chartIngresosMes = null; }

  if (!meses || meses.length === 0) {
    canvas.parentElement.innerHTML = '<p class="tabla-vacia">Sin datos mensuales.</p>';
    return;
  }

  var MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  var labels = meses.map(function(m) {
    var p = m.split('-');
    return MESES_ES[parseInt(p[1], 10) - 1] + ' \'' + p[0].substring(2);
  });

  var data = meses.map(function(m) { return mesesMap[m] || 0; });

  _chartIngresosMes = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ingresos',
        data:  data,
        borderColor:     _CHART_COLORS.accent,
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: _CHART_COLORS.accent,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return 'ARS ' + Number(ctx.raw).toLocaleString('es-AR', { maximumFractionDigits: 0 });
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: _CHART_COLORS.text, maxRotation: 45, minRotation: 0, font: { size: 10 } },
          grid:  { color: _CHART_COLORS.grid }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: _CHART_COLORS.text,
            font:  { size: 10 },
            callback: function(v) {
              if (v >= 1000000) return 'ARS ' + (v / 1000000).toFixed(1) + 'M';
              if (v >= 1000)    return 'ARS ' + (v / 1000).toFixed(0)    + 'K';
              return 'ARS ' + v;
            }
          },
          grid: { color: _CHART_COLORS.grid }
        }
      }
    }
  });
}

// ── Métodos de pago (donut) ───────────────────────────────────────────────────

function renderGraficoMetodosPago(pagosMap) {
  var canvas = document.getElementById('chart-metodos-pago');
  if (!canvas) return;

  if (_chartMetodosPago) { _chartMetodosPago.destroy(); _chartMetodosPago = null; }

  var entries = Object.entries(pagosMap).sort(function(a, b) { return b[1] - a[1]; });

  if (entries.length === 0) {
    canvas.parentElement.innerHTML = '<p class="tabla-vacia">Sin datos de métodos de pago.</p>';
    return;
  }

  var labels = entries.map(function(e) { return e[0]; });
  var data   = entries.map(function(e) { return e[1]; });
  var total  = data.reduce(function(s, v) { return s + v; }, 0);

  var colores = ['#f59e0b','#22c55e','#3b82f6','#a855f7','#ef4444',
                 '#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'];

  _chartMetodosPago = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colores.slice(0, labels.length),
        borderColor:     _CHART_COLORS.surface,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#e8eaf0',
            padding: 10,
            font: { size: 11 },
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : '0';
              return ctx.label + ': ARS ' +
                Number(ctx.raw).toLocaleString('es-AR', { maximumFractionDigits: 0 }) +
                ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });

  // Tabla resumen debajo del donut
  var tablaEl = document.getElementById('metodos-tabla');
  if (tablaEl) {
    var html = '<table class="tabla tabla-metodos-pago">' +
      '<thead><tr><th>Método</th><th class="td-num">Ingresos</th><th class="td-num">%</th></tr></thead>' +
      '<tbody>';
    entries.forEach(function(e, i) {
      var pct = total > 0 ? (e[1] / total * 100).toFixed(1) : '0';
      html += '<tr>' +
        '<td><span class="metodo-dot" style="background:' + (colores[i] || '#888') + '"></span>' +
        _escap(e[0]) + '</td>' +
        '<td class="td-num">ARS ' + Number(e[1]).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + '</td>' +
        '<td class="td-num">' + pct + '%</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tablaEl.innerHTML = html;
  }
}

function _escap(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── ABC Pareto (bar + line) ───────────────────────────────────────────────────
// Llamado desde analisis-abc.js → renderAnalisisABC()

function renderGraficoABC(analisis) {
  var canvas = document.getElementById('chart-abc');
  if (!canvas) return;

  if (_chartABC) { _chartABC.destroy(); _chartABC = null; }

  var productos = analisis.productos.slice(0, 20); // máx 20 para legibilidad

  var labels = productos.map(function(p) {
    return p.productoSKU || p.productoNombre.substring(0, 12);
  });
  var ingresos = productos.map(function(p) { return p.ingresoTotal; });
  var pctAcum  = productos.map(function(p) { return p.porcentajeAcumulado; });

  var coloresBarras = productos.map(function(p) {
    if (p.clase === 'A') return 'rgba(34,197,94,0.8)';
    if (p.clase === 'B') return 'rgba(234,179,8,0.8)';
    return 'rgba(239,68,68,0.8)';
  });

  _chartABC = new Chart(canvas, {
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
          data: pctAcum,
          type: 'line',
          borderColor: _CHART_COLORS.accent,
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderWidth: 2,
          fill: false,
          yAxisID: 'y1',
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#e8eaf0', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex === 0) {
                return 'Ingresos: ARS ' +
                  Number(ctx.parsed.y).toLocaleString('es-AR', { maximumFractionDigits: 0 });
              }
              return '% Acum: ' + ctx.parsed.y.toFixed(1) + '%';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: _CHART_COLORS.text, maxRotation: 45, minRotation: 45, font: { size: 10 } },
          grid:  { color: _CHART_COLORS.grid }
        },
        y: {
          type: 'linear',
          position: 'left',
          ticks: {
            color: _CHART_COLORS.text,
            font: { size: 10 },
            callback: function(v) {
              if (v >= 1000000) return 'ARS ' + (v / 1000000).toFixed(1) + 'M';
              if (v >= 1000)    return 'ARS ' + (v / 1000).toFixed(0)    + 'K';
              return 'ARS ' + v;
            }
          },
          grid: { color: _CHART_COLORS.grid }
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          ticks: { color: _CHART_COLORS.accent, callback: function(v) { return v + '%'; }, font: { size: 10 } },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}
