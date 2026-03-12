/**
 * produccion-ui.js
 * Interfaz de usuario para el módulo de producción
 */

var _lineasOrden = [];
var _productoTemp = null;
var _dropdownIdx = -1;

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NUEVA ORDEN
// ══════════════════════════════════════════════════════════════════════════════

function abrirModalNuevaOrden() {
  limpiarModalOrden();
  document.getElementById('modal-nueva-orden').style.display = 'flex';
  document.getElementById('campo-producto-buscar').focus();
}

function cerrarModalNuevaOrden() {
  document.getElementById('modal-nueva-orden').style.display = 'none';
  limpiarModalOrden();
}

function limpiarModalOrden() {
  _lineasOrden = [];
  _productoTemp = null;
  document.getElementById('campo-producto-buscar').value = '';
  document.getElementById('campo-cantidad-agregar').value = '1';
  document.getElementById('producto-dropdown').style.display = 'none';
  document.getElementById('campo-numero-externo').value = '';
  document.getElementById('campo-cliente').value = '';
  document.getElementById('campo-canal').value = '';
  document.getElementById('campo-metodo-pago').value = '';
  document.getElementById('campo-comentario').value = '';
  document.getElementById('campo-espontanea').checked = false;
  document.getElementById('viabilidad-modal').innerHTML = '';
  document.getElementById('modal-orden-error').style.display = 'none';
  document.getElementById('btn-crear-orden').textContent = 'Crear orden';
  renderLineasOrden();
}

// ══════════════════════════════════════════════════════════════════════════════
// BUSCADOR DE PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════

function buscarProducto(query) {
  var dropdown = document.getElementById('producto-dropdown');
  var productos = window.AppData.productos || [];
  var q = (query || '').toLowerCase();
  
  var resultados = q.length < 1 
    ? productos.slice(0, 20)
    : productos.filter(function(p) {
        return (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
      }).slice(0, 20);
  
  if (resultados.length === 0) {
    dropdown.innerHTML = '<div class="producto-dropdown-empty">No se encontraron productos</div>';
  } else {
    dropdown.innerHTML = resultados.map(function(p) {
      return '<div class="producto-dropdown-item" onclick="seleccionarProductoTemp(\'' + p.id + '\')">' +
        (p.sku ? '<span class="sku">[' + esc(p.sku) + ']</span>' : '') + esc(p.nombre) + '</div>';
    }).join('');
  }
  dropdown.style.display = 'block';
  _dropdownIdx = -1;
}

function seleccionarProductoTemp(id) {
  var p = window.AppData.productos.find(function(x) { return x.id === id; });
  if (!p) return;
  _productoTemp = p;
  document.getElementById('campo-producto-buscar').value = (p.sku ? '[' + p.sku + '] ' : '') + p.nombre;
  document.getElementById('producto-dropdown').style.display = 'none';
  document.getElementById('campo-cantidad-agregar').focus();
  document.getElementById('campo-cantidad-agregar').select();
}

// Navegación con teclado en el dropdown
document.addEventListener('DOMContentLoaded', function() {
  var campoBuscar = document.getElementById('campo-producto-buscar');
  var campoCantidad = document.getElementById('campo-cantidad-agregar');
  
  if (campoBuscar) {
    campoBuscar.addEventListener('keydown', function(e) {
      var dropdown = document.getElementById('producto-dropdown');
      var items = dropdown.querySelectorAll('.producto-dropdown-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _dropdownIdx = Math.min(_dropdownIdx + 1, items.length - 1);
        items.forEach(function(it, i) { it.classList.toggle('active', i === _dropdownIdx); });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _dropdownIdx = Math.max(_dropdownIdx - 1, 0);
        items.forEach(function(it, i) { it.classList.toggle('active', i === _dropdownIdx); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_dropdownIdx >= 0 && items[_dropdownIdx]) items[_dropdownIdx].click();
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });
  }
  
  if (campoCantidad) {
    campoCantidad.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        agregarLineaOrden();
      }
    });
  }
  
  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', function(e) {
    cerrarMenu();
    var container = document.querySelector('.producto-search-container');
    if (container && !container.contains(e.target)) {
      document.getElementById('producto-dropdown').style.display = 'none';
    }
  });
  
  // Ocultar modales inicialmente
  document.getElementById('modal-nueva-orden').style.display = 'none';
  document.getElementById('modal-finalizar').style.display = 'none';
});

// ══════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE LÍNEAS
// ══════════════════════════════════════════════════════════════════════════════

function agregarLineaOrden() {
  if (!_productoTemp) {
    alert('Seleccioná un producto primero');
    return;
  }
  
  var cant = parseFloat(document.getElementById('campo-cantidad-agregar').value) || 1;
  if (cant < 1) cant = 1;
  
  var existente = _lineasOrden.find(function(l) { return l.productoId === _productoTemp.id; });
  if (existente) {
    existente.cantidad += cant;
  } else {
    _lineasOrden.push({
      productoId: _productoTemp.id,
      productoNombre: _productoTemp.nombre,
      productoSku: _productoTemp.sku || '',
      cantidad: cant
    });
  }
  
  _productoTemp = null;
  document.getElementById('campo-producto-buscar').value = '';
  document.getElementById('campo-cantidad-agregar').value = '1';
  document.getElementById('campo-producto-buscar').focus();
  
  renderLineasOrden();
  actualizarViabilidadModal();
}

function quitarLineaOrden(i) {
  _lineasOrden.splice(i, 1);
  renderLineasOrden();
  actualizarViabilidadModal();
}

function renderLineasOrden() {
  var container = document.getElementById('lineas-orden-container');
  
  if (_lineasOrden.length === 0) {
    container.innerHTML = '<div class="lineas-vacio">No hay productos agregados</div>';
    return;
  }
  
  var html = '<div class="lineas-orden">';
  _lineasOrden.forEach(function(l, i) {
    html += '<div class="linea-orden">' +
      '<div class="linea-producto">' +
        (l.productoSku ? '<span class="sku-tag">' + esc(l.productoSku) + '</span> ' : '') +
        esc(l.productoNombre) +
      '</div>' +
      '<div class="linea-cantidad">' + fmtNum(l.cantidad) + ' u.</div>' +
      '<button type="button" class="linea-quitar" onclick="quitarLineaOrden(' + i + ')">&times;</button>' +
    '</div>';
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// VIABILIDAD
// ══════════════════════════════════════════════════════════════════════════════

function actualizarViabilidadModal() {
  var panel = document.getElementById('viabilidad-modal');
  
  if (_lineasOrden.length === 0) {
    panel.innerHTML = '';
    return;
  }
  
  var v = verificarViabilidadOrdenMultiple(_lineasOrden);
  panel.innerHTML = renderViabHtml(v);
}

function renderViabHtml(v) {
  if (v.ok) {
    return '<div class="viabilidad-ok">✔ Producción viable para todos los productos</div>';
  }
  
  var html = '<div class="viabilidad-error">✘ Insumos insuficientes<ul class="viabilidad-faltantes">';
  (v.faltantes || []).forEach(function(f) {
    html += '<li><strong>' + esc(f.nombre) + '</strong> — faltan ' + 
      fmtNum(f.deficit) + ' ' + esc(f.unidad || '') + '</li>';
  });
  html += '</ul></div>';
  return html;
}

// ══════════════════════════════════════════════════════════════════════════════
// GUARDAR ORDEN
// ══════════════════════════════════════════════════════════════════════════════

function toggleEspontaneaModal() {
  var checked = document.getElementById('campo-espontanea').checked;
  document.getElementById('btn-crear-orden').textContent = checked ? 'Producir ahora' : 'Crear orden';
}

function guardarOrdenModal() {
  var err = document.getElementById('modal-orden-error');
  err.style.display = 'none';
  
  if (_lineasOrden.length === 0) {
    err.textContent = 'Agregá al menos un producto.';
    err.style.display = 'flex';
    return;
  }
  
  try {
    var esp = document.getElementById('campo-espontanea').checked;
    var orden = crearOrden({
      lineas: _lineasOrden,
      cliente: document.getElementById('campo-cliente').value,
      numeroExterno: document.getElementById('campo-numero-externo').value,
      canal: document.getElementById('campo-canal').value,
      metodoPago: document.getElementById('campo-metodo-pago').value,
      notas: document.getElementById('campo-comentario').value,
      espontanea: esp
    });
    
    agregarOrden(orden);
    
    if (esp) {
      finalizarOrdenEspontanea(orden.id);
    }
    
    cerrarModalNuevaOrden();
    renderTablasOrdenes();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'flex';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER TABLAS
// ══════════════════════════════════════════════════════════════════════════════

function renderTablasOrdenes() {
  var pend = getOrdenes().filter(function(o) { return o.estado === 'pendiente'; }).reverse();
  var fin = getOrdenes().filter(function(o) { return o.estado === 'finalizada'; }).reverse();
  
  document.getElementById('badge-pendientes').textContent = pend.length + (pend.length === 1 ? ' orden' : ' órdenes');
  document.getElementById('badge-finalizadas').textContent = fin.length + (fin.length === 1 ? ' orden' : ' órdenes');
  
  // Tabla pendientes
  var wP = document.getElementById('tabla-pendientes');
  if (pend.length === 0) {
    wP.innerHTML = '<p class="tabla-vacia">Sin órdenes pendientes.</p>';
  } else {
    var filas = pend.map(function(o) {
      var lin = obtenerLineasOrden(o);
      var v = verificarViabilidadOrdenMultiple(lin);
      var vt = v.ok ? '<span class="tag tag-ok">✔ Viable</span>' : '<span class="tag tag-error">✘ Falta stock</span>';
      var vd = v.ok ? '' : '<div class="viab-faltantes-mini">' + 
        (v.faltantes || []).slice(0, 2).map(function(f) { return '<span>• ' + esc(f.nombre) + '</span>'; }).join('') + '</div>';
      var f = new Date(o.fechaCreacion).toLocaleDateString('es-AR');
      var inf = [o.canal, o.metodoPago].filter(Boolean).join(' · ');
      
      return '<tr>' +
        '<td class="presup-num">N°' + String(o.numero).padStart(4, '0') + 
          (o.numeroExterno ? '<br><small>' + esc(o.numeroExterno) + '</small>' : '') + '</td>' +
        '<td>' + renderProdsTabla(o) + '</td>' +
        '<td>' + vt + vd + '</td>' +
        '<td class="td-wrap">' + esc(o.cliente || '—') + (inf ? '<br><small>' + esc(inf) + '</small>' : '') + '</td>' +
        '<td class="td-wrap">' + esc(o.notas || '—') + '</td>' +
        '<td>' + f + '</td>' +
        '<td><button class="btn-menu" data-id="' + o.id + '" data-num="' + o.numero + '" data-tipo="pendiente" onclick="mostrarMenu(event, this)">⋮</button></td>' +
      '</tr>';
    }).join('');
    
    wP.innerHTML = '<table class="tabla"><thead><tr>' +
      '<th>N°</th><th>Productos</th><th>Viabilidad</th><th>Cliente</th><th>Notas</th><th>Fecha</th><th></th>' +
      '</tr></thead><tbody>' + filas + '</tbody></table>';
  }
  
  // Tabla finalizadas
  var wF = document.getElementById('tabla-finalizadas');
  if (fin.length === 0) {
    wF.innerHTML = '<p class="tabla-vacia">Sin órdenes finalizadas.</p>';
  } else {
    var filas = fin.slice(0, 50).map(function(o) {
      var fc = new Date(o.fechaCreacion).toLocaleDateString('es-AR');
      var ff = o.fechaFinalizada ? new Date(o.fechaFinalizada).toLocaleDateString('es-AR') : '—';
      var tt = o.espontanea ? '<span class="tag tag-espontanea">Esp</span>' : '';
      var inf = [o.canal, o.metodoPago].filter(Boolean).join(' · ');
      
      return '<tr>' +
        '<td class="presup-num">N°' + String(o.numero).padStart(4, '0') + tt +
          (o.numeroExterno ? '<br><small>' + esc(o.numeroExterno) + '</small>' : '') + '</td>' +
        '<td>' + renderProdsTabla(o) + '</td>' +
        '<td class="td-wrap">' + esc(o.cliente || '—') + (inf ? '<br><small>' + esc(inf) + '</small>' : '') + '</td>' +
        '<td class="td-wrap">' + esc(o.notas || '—') + '</td>' +
        '<td>' + fc + '</td>' +
        '<td>' + ff + '</td>' +
        '<td><button class="btn-menu" data-id="' + o.id + '" data-tipo="finalizada" onclick="mostrarMenu(event, this)">⋮</button></td>' +
      '</tr>';
    }).join('');
    
    wF.innerHTML = '<table class="tabla"><thead><tr>' +
      '<th>N°</th><th>Productos</th><th>Cliente</th><th>Notas</th><th>Creada</th><th>Finalizada</th><th></th>' +
      '</tr></thead><tbody>' + filas + '</tbody></table>';
  }
}

function renderProdsTabla(orden) {
  var lineas = obtenerLineasOrden(orden);
  if (lineas.length === 0) return '—';
  
  var html = '<div class="productos-lista-mini">';
  lineas.forEach(function(l) {
    html += '<div class="producto-item">' +
      '<span class="producto-cantidad">' + fmtNum(l.cantidad) + 'u.</span>' +
      (l.productoSku ? '<span class="sku-tag">' + esc(l.productoSku) + '</span> ' : '') +
      esc(l.productoNombre) +
    '</div>';
  });
  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════════════════════
// MENÚ DROPDOWN
// ══════════════════════════════════════════════════════════════════════════════

function mostrarMenu(e, btn) {
  e.stopPropagation();
  
  var menu = document.getElementById('dropdown-global');
  var id = btn.getAttribute('data-id');
  var num = btn.getAttribute('data-num');
  var tipo = btn.getAttribute('data-tipo');
  
  // Posicionar el menú
  var rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(10, rect.right - 150) + 'px';
  
  // Generar contenido según tipo
  var html = '';
  if (tipo === 'pendiente') {
    html = '<button onclick="cerrarMenu(); abrirModalFinalizar(\'' + id + '\')">✔ Finalizar</button>' +
           '<button onclick="cerrarMenu(); exportarPDF(\'' + id + '\')">📄 PDF</button>' +
           '<button class="text-danger" onclick="cerrarMenu(); elimOrden(\'' + id + '\', ' + num + ')">🗑 Eliminar</button>';
  } else {
    html = '<button onclick="cerrarMenu(); exportarPDF(\'' + id + '\')">📄 PDF</button>';
  }
  menu.innerHTML = html;
  menu.classList.add('show');
}

function cerrarMenu() {
  document.getElementById('dropdown-global').classList.remove('show');
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL FINALIZAR
// ══════════════════════════════════════════════════════════════════════════════

function abrirModalFinalizar(id) {
  var o = getOrdenPorId(id);
  if (!o) return;
  
  var lineas = obtenerLineasOrden(o);
  var v = verificarViabilidadOrdenMultiple(lineas);
  
  document.getElementById('modal-finalizar-titulo').textContent = 'Finalizar N°' + String(o.numero).padStart(4, '0');
  document.getElementById('modal-finalizar-detalle').innerHTML = 
    '<p><strong>Productos:</strong></p>' + renderProdsTabla(o) + renderViabHtml(v);
  
  document.getElementById('btn-confirmar-finalizar').onclick = function() {
    try {
      if (o.espontanea) {
        finalizarOrdenEspontanea(id);
      } else {
        finalizarOrden(id);
      }
      cerrarModalFinalizar();
      renderTablasOrdenes();
    } catch (e) {
      alert(e.message);
    }
  };
  
  document.getElementById('modal-finalizar').style.display = 'flex';
}

function cerrarModalFinalizar() {
  document.getElementById('modal-finalizar').style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR Y EXPORTAR
// ══════════════════════════════════════════════════════════════════════════════

function elimOrden(id, num) {
  if (!confirm('¿Eliminar orden N°' + String(num).padStart(4, '0') + '?')) return;
  eliminarOrden(id);
  renderTablasOrdenes();
}

function exportarPDF(id) {
  var o = getOrdenPorId(id);
  if (!o) return;
  
  var fecha = new Date(o.fechaCreacion).toLocaleDateString('es-AR');
  var lineas = obtenerLineasOrden(o);
  
  var prodsHtml = '';
  if (lineas.length > 0) {
    prodsHtml = '<h3>Productos</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
      '<thead><tr style="background:#f0f0f0;"><th>SKU</th><th>Producto</th><th style="text-align:right;">Cantidad</th></tr></thead><tbody>';
    lineas.forEach(function(l) {
      prodsHtml += '<tr><td>' + (l.productoSku || '—') + '</td><td>' + esc(l.productoNombre) + 
        '</td><td style="text-align:right;">' + fmtNum(l.cantidad) + ' u.</td></tr>';
    });
    prodsHtml += '</tbody></table>';
  }
  
  var html = '<html><head><title>Orden ' + o.numero + '</title>' +
    '<style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}h2{margin-bottom:4px}table{font-size:14px}th,td{text-align:left;padding:6px 10px}</style></head>' +
    '<body><h2>Orden de producción N° ' + String(o.numero).padStart(4, '0') + '</h2>' +
    '<p style="color:#666;margin-top:0;">Fecha: ' + fecha + '</p>' +
    (o.cliente ? '<p><strong>Cliente:</strong> ' + esc(o.cliente) + '</p>' : '') +
    (o.numeroExterno ? '<p><strong>N° externo:</strong> ' + esc(o.numeroExterno) + '</p>' : '') +
    (o.canal ? '<p><strong>Canal:</strong> ' + esc(o.canal) + '</p>' : '') +
    (o.metodoPago ? '<p><strong>Método pago:</strong> ' + esc(o.metodoPago) + '</p>' : '') +
    (o.notas ? '<p><strong>Notas:</strong> ' + esc(o.notas) + '</p>' : '') +
    '<hr style="margin:16px 0;">' + prodsHtml + '</body></html>';
  
  var w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtNum(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function handleImport(event) {
  var file = event.target.files[0];
  if (!file) return;
  importData(file)
    .then(function() { alert('Importado.'); location.reload(); })
    .catch(function(err) { alert(err.message); });
}

// Función que llama app.js al cargar
function renderProduccionPage() {
  renderTablasOrdenes();
}
