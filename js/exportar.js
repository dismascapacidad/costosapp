/**
 * exportar.js
 * Exportación de listas de precios (Excel y PDF) y presupuestos.
 *
 * FUNCIONES PÚBLICAS:
 *   exportarListaPrecios(productos, insumos, config)
 *   exportarListaPreciosPDF(productos, insumos, config)
 *   exportarPresupuesto(presupuesto)
 */

// ── Helpers internos ────────────────────────────────────────────────────────

function _fmtPrecio(valor, moneda) {
  if (moneda === 'USD') {
    return 'USD ' + Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return 'ARS ' + Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _convertirPrecio(precioARS, moneda, dolarCompra) {
  if (moneda === 'USD' && dolarCompra > 0) {
    return precioARS / dolarCompra;
  }
  return precioARS;
}

function _prepararDatosLista(productos, insumos, config) {
  var tipo          = config.tipo || 'ambos';
  var moneda        = config.moneda || 'ARS';
  var dolarCompra   = config.dolarCompra || 0;
  var cliente       = config.cliente || '';

  var mostrarConsumidor   = tipo === 'consumidor'   || tipo === 'ambos';
  var mostrarDistribuidor = tipo === 'distribuidor' || tipo === 'ambos';

  // Agrupar por categoría y ordenar
  var grupos = {};
  productos.forEach(function(p) {
    var cat = (p.categoria || '').trim() || 'Sin categoría';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  });
  Object.keys(grupos).forEach(function(cat) {
    grupos[cat].sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  });
  var catOrdenadas = Object.keys(grupos).sort(function(a, b) {
    if (a === 'Sin categoría') return 1;
    if (b === 'Sin categoría') return -1;
    return a.localeCompare(b, 'es');
  });

  return {
    tipo: tipo,
    moneda: moneda,
    dolarCompra: dolarCompra,
    cliente: cliente,
    mostrarConsumidor: mostrarConsumidor,
    mostrarDistribuidor: mostrarDistribuidor,
    grupos: grupos,
    catOrdenadas: catOrdenadas,
    insumos: insumos
  };
}

// ── Exportar lista de precios a Excel ───────────────────────────────────────

function exportarListaPrecios(productos, insumos, config) {
  if (!config) config = {};
  var d = _prepararDatosLista(productos, insumos, config);
  var fecha = new Date().toLocaleDateString('es-AR');

  if (productos.length === 0) throw new Error('No hay productos para exportar.');

  var data = [];

  // Encabezado tipo presupuesto
  data.push(['LISTA DE PRECIOS']);
  data.push([]);
  if (d.cliente) data.push(['Cliente:', d.cliente]);
  data.push(['Fecha:', fecha]);
  data.push(['Moneda:', d.moneda === 'USD' ? 'Dólares (USD)' : 'Pesos argentinos (ARS)']);
  if (d.moneda === 'USD' && d.dolarCompra > 0) {
    data.push(['Cotización USD (compra):', '$ ' + Number(d.dolarCompra).toLocaleString('es-AR')]);
  }
  data.push([]);

  // Headers
  var headers = ['SKU', 'Producto'];
  if (d.mostrarConsumidor)   headers.push('Precio consumidor (' + d.moneda + ')');
  if (d.mostrarDistribuidor) headers.push('Precio distribuidor (' + d.moneda + ')');
  data.push(headers);

  // Filas agrupadas por categoría
  d.catOrdenadas.forEach(function(cat) {
    // Fila de categoría
    data.push([cat.toUpperCase()]);

    d.grupos[cat].forEach(function(p) {
      var precioConsumidor   = 0;
      var precioDistribuidor = 0;
      try {
        var resumen = calcularResumen(p, insumos);
        precioConsumidor   = _convertirPrecio(resumen.precioFinal, d.moneda, d.dolarCompra);
        precioDistribuidor = _convertirPrecio(resumen.precioDistribuidor, d.moneda, d.dolarCompra);
      } catch (_) {}

      var fila = [p.sku || '—', p.nombre];
      if (d.mostrarConsumidor)   fila.push(precioConsumidor);
      if (d.mostrarDistribuidor) fila.push(precioDistribuidor);
      data.push(fila);
    });
  });

  // Footer
  data.push([]);
  data.push(['Lista generada por CostosApp — ' + fecha]);

  // Crear Excel con SheetJS
  if (typeof XLSX === 'undefined') {
    _exportarComoCSV(data, d.moneda);
    return;
  }

  var ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 38 },
    { wch: 24 },
    { wch: 24 }
  ];

  // Formato numérico en celdas de precios
  var range = XLSX.utils.decode_range(ws['!ref']);
  var headerRowIdx = -1;
  for (var ri = 0; ri <= range.e.r; ri++) {
    var cell = ws[XLSX.utils.encode_cell({ r: ri, c: 0 })];
    if (cell && cell.v === 'SKU') { headerRowIdx = ri; break; }
  }

  if (headerRowIdx >= 0) {
    var fmt = d.moneda === 'USD' ? '"USD "#,##0.00' : '"ARS "#,##0.00';
    for (var R = headerRowIdx + 1; R <= range.e.r; R++) {
      for (var C = 2; C <= range.e.c; C++) {
        var addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[addr] && typeof ws[addr].v === 'number') {
          ws[addr].z = fmt;
          ws[addr].t = 'n';
        }
      }
    }
  }

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios');

  var fname = 'lista_precios_' + d.moneda.toLowerCase() + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}

// ── Exportar lista de precios a PDF (via print window, estilo presupuestos) ──

function exportarListaPreciosPDF(productos, insumos, config) {
  if (!config) config = {};
  var d = _prepararDatosLista(productos, insumos, config);
  var fecha = new Date().toLocaleDateString('es-AR');

  if (productos.length === 0) throw new Error('No hay productos para exportar.');

  // Construir filas HTML agrupadas
  var filasHTML = '';
  d.catOrdenadas.forEach(function(cat) {
    var colspan = 2 + (d.mostrarConsumidor ? 1 : 0) + (d.mostrarDistribuidor ? 1 : 0);
    filasHTML += '<tr class="fila-cat"><td colspan="' + colspan + '">' + _escaparHTML(cat.toUpperCase()) + '</td></tr>';

    d.grupos[cat].forEach(function(p) {
      var precioConsumidor   = 0;
      var precioDistribuidor = 0;
      try {
        var resumen = calcularResumen(p, insumos);
        precioConsumidor   = _convertirPrecio(resumen.precioFinal, d.moneda, d.dolarCompra);
        precioDistribuidor = _convertirPrecio(resumen.precioDistribuidor, d.moneda, d.dolarCompra);
      } catch (_) {}

      filasHTML += '<tr>' +
        '<td>' + _escaparHTML(p.sku || '—') + '</td>' +
        '<td>' + _escaparHTML(p.nombre) + '</td>';
      if (d.mostrarConsumidor)   filasHTML += '<td style="text-align:right">' + _fmtPrecio(precioConsumidor, d.moneda) + '</td>';
      if (d.mostrarDistribuidor) filasHTML += '<td style="text-align:right">' + _fmtPrecio(precioDistribuidor, d.moneda) + '</td>';
      filasHTML += '</tr>';
    });
  });

  // Headers de tabla
  var thHTML = '<th>SKU</th><th>Producto</th>';
  if (d.mostrarConsumidor)   thHTML += '<th style="text-align:right">Precio consumidor (' + d.moneda + ')</th>';
  if (d.mostrarDistribuidor) thHTML += '<th style="text-align:right">Precio distribuidor (' + d.moneda + ')</th>';

  var cotizHTML = '';
  if (d.moneda === 'USD' && d.dolarCompra > 0) {
    cotizHTML = '<strong>Cotización USD (compra):</strong> $ ' +
      Number(d.dolarCompra).toLocaleString('es-AR') + '<br>';
  }

  var contenido = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Lista de precios</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;color:#222;margin:2rem;font-size:13px;}' +
      'h1{font-size:1.4rem;margin-bottom:0.25rem;}' +
      '.info{margin:1rem 0;line-height:1.8;}' +
      '.info strong{display:inline-block;width:200px;}' +
      'table{width:100%;border-collapse:collapse;margin:1rem 0;}' +
      'th{background:#f5f5f5;text-align:left;padding:6px 8px;border-bottom:2px solid #999;font-size:0.8rem;}' +
      'td{padding:5px 8px;border-bottom:1px solid #ddd;}' +
      '.fila-cat td{background:#f0f0f0;font-weight:700;font-size:0.78rem;letter-spacing:0.05em;padding:8px;border-bottom:2px solid #bbb;}' +
      '.footer{margin-top:2rem;font-size:0.75rem;color:#777;border-top:1px solid #ccc;padding-top:0.5rem;}' +
    '</style></head><body>' +
    '<h1>LISTA DE PRECIOS</h1>' +
    '<div class="info">' +
      (d.cliente ? '<strong>Cliente:</strong> ' + _escaparHTML(d.cliente) + '<br>' : '') +
      '<strong>Fecha:</strong> ' + fecha + '<br>' +
      '<strong>Moneda:</strong> ' + (d.moneda === 'USD' ? 'Dólares (USD)' : 'Pesos argentinos (ARS)') + '<br>' +
      cotizHTML +
    '</div>' +
    '<table><thead><tr>' + thHTML + '</tr></thead>' +
    '<tbody>' + filasHTML + '</tbody></table>' +
    '<div class="footer">Lista generada por CostosApp — ' + fecha + '</div>' +
    '</body></html>';

  var ventana = window.open('', '_blank', 'width=800,height=600');
  ventana.document.write(contenido);
  ventana.document.close();
  ventana.focus();
  setTimeout(function() { ventana.print(); }, 400);
}

function _escaparHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Fallback CSV ────────────────────────────────────────────────────────────

function _exportarComoCSV(data, moneda) {
  var csv = data.map(function(row) {
    return row.map(function(cell) {
      var str = String(cell == null ? '' : cell);
      if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');

  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var fname = 'lista_precios_' + (moneda || 'ARS').toLowerCase() + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  var a = document.createElement('a');
  a.href = url;
  a.download = fname;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Exportar presupuesto a Excel (sin cambios) ─────────────────────────────

function exportarPresupuesto(presupuesto) {
  var p = presupuesto;
  var fecha = new Date(p.fecha).toLocaleDateString('es-AR');
  var vence = new Date(p.fechaVencimiento).toLocaleDateString('es-AR');
  var tipo = p.tipoCliente === 'distribuidor' ? 'Distribuidor' : 'Consumidor final';

  var data = [];
  data.push(['PRESUPUESTO N° ' + p.numero]);
  data.push([]);
  data.push(['Fecha:', fecha]);
  data.push(['Válido hasta:', vence]);
  data.push(['Cliente:', p.nombreCliente || '—']);
  data.push(['Tipo:', tipo]);
  if (p.notas) data.push(['Notas:', p.notas]);
  data.push([]);
  data.push(['SKU', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal']);

  (p.lineas || []).forEach(function(linea) {
    data.push([
      linea.sku || '—',
      linea.nombre,
      linea.cantidad,
      linea.precioUnitario,
      linea.subtotal
    ]);
  });

  data.push([]);
  data.push(['', '', '', 'Total:', p.total || 0]);

  if (typeof XLSX === 'undefined') {
    alert('No se puede generar Excel. Falta la biblioteca SheetJS.');
    return;
  }

  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 }
  ];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');

  var fname = 'presupuesto_' + String(p.numero).padStart(4, '0') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}
