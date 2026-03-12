/**
 * simulador.js
 * Módulo de simulación financiera simplificado
 */

var _simData = {
  actual: null,
  chartEquilibrio: null
};

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════════════════

function initSimulador() {
  console.log('[simulador] Inicializando...');
  
  if (!window.AppData || !window.AppData.productos) {
    console.error('[simulador] AppData no disponible');
    return;
  }
  
  calcularDatosBase();
  actualizarKPIs();
  actualizarSimulacion();
  calcularEquilibrio();
  poblarProductos();
  calcularPublicidad();
  
  console.log('[simulador] Inicializado');
}

// ══════════════════════════════════════════════════════════════════════════════
// CÁLCULOS BASE
// ══════════════════════════════════════════════════════════════════════════════

function calcularDatosBase() {
  var productos = window.AppData.productos || [];
  var insumos = window.AppData.insumos || [];
  
  if (productos.length === 0) {
    _simData.actual = { margenBruto: 0, ganancia: 0, precio: 0, costo: 0 };
    return;
  }
  
  var sumaMargen = 0, sumaGanancia = 0, sumaPrecio = 0, sumaCosto = 0;
  var count = 0;
  
  productos.forEach(function(p) {
    try {
      var r = calcularResumen(p, insumos);
      sumaMargen += r.margenConsumidor;
      sumaGanancia += r.ganancia;
      sumaPrecio += r.precioFinal;
      sumaCosto += r.costoTotal;
      count++;
    } catch(e) {}
  });
  
  _simData.actual = {
    margenBruto: count > 0 ? sumaMargen / count : 0,
    ganancia: count > 0 ? sumaGanancia / count : 0,
    precio: count > 0 ? sumaPrecio / count : 0,
    costo: count > 0 ? sumaCosto / count : 0
  };
}

function actualizarKPIs() {
  var d = _simData.actual;
  var comision = 5;
  var margenNeto = d.margenBruto - comision;
  
  document.getElementById('kpi-margen-bruto').textContent = formatNum(d.margenBruto) + '%';
  document.getElementById('kpi-margen-neto').textContent = formatNum(margenNeto) + '%';
  document.getElementById('kpi-ganancia').textContent = 'ARS ' + formatNum(d.ganancia);
  
  // Equilibrio
  var gastos = 1250000;
  var contribucion = d.ganancia - (d.precio * comision / 100);
  var equilibrio = contribucion > 0 ? gastos / contribucion : 0;
  document.getElementById('kpi-equilibrio').textContent = Math.ceil(equilibrio);
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMULACIÓN
// ══════════════════════════════════════════════════════════════════════════════

function actualizarSimulacion() {
  var varDolar = parseFloat(document.getElementById('sim-dolar').value) || 0;
  var varMargen = parseFloat(document.getElementById('sim-margen').value) || 0;
  var descuentoDistrib = parseFloat(document.getElementById('sim-descuento-distrib').value) || 20;
  var comision = parseFloat(document.getElementById('sim-comision').value) || 5;
  var mixDistrib = parseFloat(document.getElementById('sim-mix').value) || 10;
  
  // Actualizar labels
  document.getElementById('val-dolar').textContent = (varDolar >= 0 ? '+' : '') + varDolar + '%';
  document.getElementById('val-margen').textContent = (varMargen >= 0 ? '+' : '') + varMargen + ' pp';
  document.getElementById('val-descuento-distrib').textContent = descuentoDistrib + '%';
  document.getElementById('val-mix').textContent = mixDistrib + '%';
  
  var d = _simData.actual;
  
  // Actual
  var actualMargenNeto = d.margenBruto - 5; // 5% comisión estándar
  document.getElementById('res-actual-margen').textContent = formatNum(d.margenBruto) + '%';
  document.getElementById('res-actual-neto').textContent = formatNum(actualMargenNeto) + '%';
  document.getElementById('res-actual-ganancia').textContent = 'ARS ' + formatNum(d.ganancia);
  document.getElementById('res-actual-precio').textContent = 'ARS ' + formatNum(d.precio);
  
  // === SIMULADO ===
  
  // Efecto del dólar en costos (asumiendo 30% de insumos son importados)
  var factorDolar = 1 + (varDolar / 100) * 0.3;
  var costoSim = d.costo * factorDolar;
  
  // Nuevo margen consumidor
  var margenConsumidor = d.margenBruto + varMargen;
  margenConsumidor = Math.max(0, Math.min(99, margenConsumidor));
  
  // Precio consumidor desde margen
  var precioConsumidor = costoSim / (1 - margenConsumidor / 100);
  var gananciaConsumidor = precioConsumidor - costoSim;
  
  // Precio distribuidor (con descuento sobre precio consumidor)
  var precioDistribuidor = precioConsumidor * (1 - descuentoDistrib / 100);
  var gananciaDistribuidor = precioDistribuidor - costoSim;
  var margenDistribuidor = precioDistribuidor > 0 ? ((precioDistribuidor - costoSim) / precioDistribuidor) * 100 : 0;
  
  // Mix ponderado
  var mixConsumidor = (100 - mixDistrib) / 100;
  var mixDistribDecimal = mixDistrib / 100;
  
  var precioPonderado = precioConsumidor * mixConsumidor + precioDistribuidor * mixDistribDecimal;
  var gananciaPonderada = gananciaConsumidor * mixConsumidor + gananciaDistribuidor * mixDistribDecimal;
  
  // Margen neto ponderado (considerando comisión)
  var gananciaNetaConsumidor = gananciaConsumidor - (precioConsumidor * comision / 100);
  var gananciaNetaDistribuidor = gananciaDistribuidor; // Distribuidores pagan por transferencia, sin comisión
  var gananciaNetaPonderada = gananciaNetaConsumidor * mixConsumidor + gananciaNetaDistribuidor * mixDistribDecimal;
  
  var margenNetoPonderado = precioPonderado > 0 ? (gananciaNetaPonderada / precioPonderado) * 100 : 0;
  
  document.getElementById('res-sim-margen').textContent = formatNum(margenConsumidor) + '%';
  document.getElementById('res-sim-neto').textContent = formatNum(margenNetoPonderado) + '%';
  document.getElementById('res-sim-ganancia').textContent = 'ARS ' + formatNum(gananciaNetaPonderada);
  document.getElementById('res-sim-precio').textContent = 'ARS ' + formatNum(precioPonderado);
  
  // Guardar valores simulados para usar en equilibrio
  _simData.simulado = {
    costo: costoSim,
    precio: precioPonderado,
    ganancia: gananciaNetaPonderada,
    margenBruto: margenConsumidor,
    comision: comision,
    mixDistrib: mixDistrib,
    // Para el gráfico de equilibrio, usamos la contribución neta ponderada
    contribucionNeta: gananciaNetaPonderada
  };
  
  // Actualizar punto de equilibrio con valores simulados
  calcularEquilibrio();
}

function resetearSimulacion() {
  document.getElementById('sim-dolar').value = 0;
  document.getElementById('sim-margen').value = 0;
  document.getElementById('sim-comision').value = 5;
  document.getElementById('sim-mix').value = 10;
  actualizarSimulacion();
}

// ══════════════════════════════════════════════════════════════════════════════
// PUNTO DE EQUILIBRIO
// ══════════════════════════════════════════════════════════════════════════════

function calcularEquilibrio() {
  var gastos = parseFloat(document.getElementById('eq-gastos').value) || 0;
  
  // Usar valores simulados si existen, sino usar actuales
  var d = _simData.simulado || _simData.actual;
  
  // La contribución ya viene calculada con el mix ponderado
  var contribucion;
  if (_simData.simulado && _simData.simulado.contribucionNeta !== undefined) {
    contribucion = _simData.simulado.contribucionNeta;
  } else {
    // Fallback para el cálculo inicial sin simulación
    var comision = 5;
    contribucion = d.ganancia - (d.precio * comision / 100);
  }
  
  var equilibrio = contribucion > 0 ? gastos / contribucion : 0;
  var ventasEquilibrio = equilibrio * d.precio;
  var equilibrioConMargen = equilibrio * 1.2;
  
  var html = '';
  html += '<div class="eq-card"><div class="eq-valor">' + Math.ceil(equilibrio) + '</div><div class="eq-label">Unidades/mes mínimo</div></div>';
  html += '<div class="eq-card"><div class="eq-valor">ARS ' + formatNum(ventasEquilibrio) + '</div><div class="eq-label">Facturación mínima</div></div>';
  html += '<div class="eq-card destacado"><div class="eq-valor">' + Math.ceil(equilibrioConMargen) + '</div><div class="eq-label">Recomendado (+20%)</div></div>';
  html += '<div class="eq-card"><div class="eq-valor">ARS ' + formatNum(contribucion) + '</div><div class="eq-label">Contribución/unidad</div></div>';
  
  document.getElementById('eq-resultado').innerHTML = html;
  
  renderChartEquilibrio(gastos, contribucion, equilibrio);
}

function renderChartEquilibrio(gastos, contribucion, equilibrio) {
  var ctx = document.getElementById('chart-equilibrio');
  if (!ctx) return;
  
  if (_simData.chartEquilibrio) {
    _simData.chartEquilibrio.destroy();
  }
  
  var max = Math.ceil(equilibrio * 1.8);
  var labels = [], costosFijos = [], contribucionAcum = [];
  
  for (var i = 0; i <= max; i += Math.ceil(max / 8)) {
    labels.push(i);
    costosFijos.push(gastos);
    contribucionAcum.push(i * contribucion);
  }
  
  _simData.chartEquilibrio = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Gastos fijos',
          data: costosFijos,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0
        },
        {
          label: 'Contribución acumulada',
          data: contribucionAcum,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          fill: true,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(v) { return 'ARS ' + (v/1000000).toFixed(1) + 'M'; }
          }
        },
        x: {
          title: { display: true, text: 'Unidades vendidas' }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLICIDAD
// ══════════════════════════════════════════════════════════════════════════════

function poblarProductos() {
  var select = document.getElementById('pub-producto');
  if (!select) return;
  
  var productos = window.AppData.productos || [];
  var insumos = window.AppData.insumos || [];
  
  var opciones = productos.map(function(p) {
    try {
      var r = calcularResumen(p, insumos);
      return { id: p.id, nombre: p.nombre, ganancia: r.ganancia };
    } catch(e) {
      return { id: p.id, nombre: p.nombre, ganancia: 0 };
    }
  }).sort(function(a, b) { return b.ganancia - a.ganancia; });
  
  select.innerHTML = opciones.map(function(p) {
    return '<option value="' + p.id + '">' + escapar(p.nombre) + '</option>';
  }).join('');
}

function calcularPublicidad() {
  var presupuesto = parseFloat(document.getElementById('pub-presupuesto').value) || 0;
  var productoId = document.getElementById('pub-producto').value;
  var cpc = parseFloat(document.getElementById('pub-cpc').value) || 100;
  var conversion = parseFloat(document.getElementById('pub-conversion').value) || 2;
  
  var wrapper = document.getElementById('pub-resultado');
  
  if (!productoId || presupuesto === 0) {
    wrapper.innerHTML = '<p style="color:var(--text-3)">Completá los campos para ver el análisis.</p>';
    return;
  }
  
  var producto = window.AppData.productos.find(function(p) { return p.id === productoId; });
  if (!producto) {
    wrapper.innerHTML = '<p style="color:var(--text-3)">Producto no encontrado.</p>';
    return;
  }
  
  var resumen = calcularResumen(producto, window.AppData.insumos);
  var gananciaUnidad = resumen.ganancia - (resumen.precioFinal * 0.05); // Con comisión
  
  var clics = presupuesto / cpc;
  var ventas = clics * conversion / 100;
  var cac = ventas > 0 ? presupuesto / ventas : 0;
  var gananciaTotal = ventas * gananciaUnidad;
  var resultado = gananciaTotal - presupuesto;
  var roi = presupuesto > 0 ? (resultado / presupuesto) * 100 : 0;
  
  var esRentable = roi > 0;
  
  var html = '<div class="pub-metricas">';
  html += '<div class="pub-metrica"><div class="pub-metrica-valor">' + Math.floor(clics) + '</div><div class="pub-metrica-label">Clics</div></div>';
  html += '<div class="pub-metrica"><div class="pub-metrica-valor">' + ventas.toFixed(1) + '</div><div class="pub-metrica-label">Ventas estimadas</div></div>';
  html += '<div class="pub-metrica"><div class="pub-metrica-valor">$' + formatNum(cac) + '</div><div class="pub-metrica-label">Costo por venta</div></div>';
  html += '<div class="pub-metrica"><div class="pub-metrica-valor ' + (esRentable ? 'good' : 'bad') + '">' + (roi >= 0 ? '+' : '') + formatNum(roi) + '%</div><div class="pub-metrica-label">ROI</div></div>';
  html += '</div>';
  
  if (esRentable) {
    html += '<div class="pub-veredicto rentable"><strong>✓ Campaña potencialmente rentable.</strong> Por cada $1 invertido recuperarías $' + (1 + roi/100).toFixed(2) + '.</div>';
  } else {
    html += '<div class="pub-veredicto riesgoso"><strong>✗ Campaña riesgosa.</strong> El costo por venta ($' + formatNum(cac) + ') supera tu ganancia neta ($' + formatNum(gananciaUnidad) + '). Mejorá la conversión o reducí el CPC.</div>';
  }
  
  wrapper.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function formatNum(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapar(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
