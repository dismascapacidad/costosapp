// productos-ui.js - UI de la pagina productos.html
// Cargado antes de app.js. initProductos() llama las funciones de aqui.

var lineasTemp      = [];
var _modoConsumidor   = 'margen';
var _modoDistribuidor = 'margen';

// ── Dolar widget (compra + venta) ───────────────────────────────────────────

function renderDolarWidget(registro) {
  if (!registro) return;
  var ventaEl  = document.getElementById('dolar-valor-venta');
  var compraEl = document.getElementById('dolar-valor-compra');
  var fuenteEl = document.getElementById('dolar-fuente');
  var fechaEl  = document.getElementById('dolar-fecha');
  if (ventaEl)  ventaEl.textContent  = '$ ' + Number(registro.venta || registro.valor || 0).toLocaleString('es-AR');
  if (compraEl) compraEl.textContent = '$ ' + Number(registro.compra || registro.valor || 0).toLocaleString('es-AR');
  if (registro.fuente === 'api') {
    fuenteEl.textContent = 'EN VIVO'; fuenteEl.className = 'dolar-fuente dolar-live'; fechaEl.textContent = '';
  } else {
    fuenteEl.textContent = 'CACHE'; fuenteEl.className = 'dolar-fuente dolar-cached';
    fechaEl.textContent = registro.fecha ? formatearAntiguedad(registro.fecha) + ' - puede estar desactualizado' : '';
  }
}

function sugerirSKU() { if (!document.getElementById('campo-sku').value) generarYponerSKU(); }
function generarYponerSKU() {
  var nombre = document.getElementById('campo-producto-nombre').value;
  var idActual = document.getElementById('campo-producto-id').value;
  var lista = idActual ? window.AppData.productos.filter(function(p) { return p.id !== idActual; }) : window.AppData.productos;
  document.getElementById('campo-sku').value = generarSKUSugerido(nombre, lista);
}

// ── Precio bidireccional (sin cambios de lógica) ────────────────────────────

function _productoDesdeForm() {
  return {
    nombre: document.getElementById('campo-producto-nombre').value.trim(),
    insumos: lineasTemp,
    horasTrabajo: parseFloat(document.getElementById('campo-producto-horas').value) || 0,
    costoHora: parseFloat(document.getElementById('campo-producto-costo-hora').value) || 0,
    modoConsumidor: _modoConsumidor,
    margenConsumidor: parseFloat(document.getElementById('campo-margen-consumidor').value) || 0,
    precioFinal: parseFloat(document.getElementById('campo-precio-final').value) || 0,
    modoDistribuidor: _modoDistribuidor,
    margenDistribuidor: parseFloat(document.getElementById('campo-margen-distribuidor').value) || 0,
    precioDistribuidor: parseFloat(document.getElementById('campo-precio-distribuidor').value) || 0
  };
}

function recalcularDesdeForm() {
  var p = _productoDesdeForm();
  var r;
  try { r = calcularResumen(p, window.AppData.insumos); } catch(e) { return; }

  if (_modoConsumidor === 'margen') {
    _setSilently('campo-precio-final', r.precioFinal > 0 ? fmtN(r.precioFinal) : '');
  } else {
    _setSilently('campo-margen-consumidor', r.margenConsumidor > 0 ? fmtN(r.margenConsumidor) : '');
  }
  if (_modoDistribuidor === 'margen') {
    _setSilently('campo-precio-distribuidor', r.precioDistribuidor > 0 ? fmtN(r.precioDistribuidor) : '');
  } else {
    _setSilently('campo-margen-distribuidor', r.margenDistribuidor > 0 ? fmtN(r.margenDistribuidor) : '');
  }

  var markupEl = document.getElementById('markup-info-valor');
  var hC = document.getElementById('hint-consumidor');
  var hD = document.getElementById('hint-distribuidor');

  if (r.costoTotal > 0 && r.precioFinal > 0) {
    if (markupEl) markupEl.textContent = formatNum(r.markup) + '%';
    hC.textContent = _modoConsumidor === 'margen'
      ? 'Precio calculado: ARS ' + formatNum(r.precioFinal) + ' — ganancia ARS ' + formatNum(r.ganancia)
      : 'Margen implícito: ' + formatNum(r.margenConsumidor) + '% — ganancia ARS ' + formatNum(r.ganancia);
  } else {
    if (markupEl) markupEl.textContent = '—';
    hC.textContent = '';
  }
  if (r.precioFinal > 0 && r.precioDistribuidor > 0) {
    hD.textContent = _modoDistribuidor === 'margen'
      ? 'Precio distribuidor: ARS ' + formatNum(r.precioDistribuidor)
      : 'Descuento implícito: ' + formatNum(r.margenDistribuidor) + '%';
  } else { hD.textContent = ''; }
}

function alCambiarMargenConsumidor()  { _modoConsumidor   = 'margen'; _badges(); recalcularDesdeForm(); }
function alCambiarPrecioFinal()       { _modoConsumidor   = 'precio'; _badges(); recalcularDesdeForm(); }
function alCambiarMargenDistribuidor(){ _modoDistribuidor = 'margen'; _badges(); recalcularDesdeForm(); }
function alCambiarPrecioDistribuidor(){ _modoDistribuidor = 'precio'; _badges(); recalcularDesdeForm(); }

function _badges() {
  document.getElementById('badge-modo-cons-margen').style.display  = _modoConsumidor   === 'margen' ? 'inline' : 'none';
  document.getElementById('badge-modo-cons-precio').style.display  = _modoConsumidor   === 'precio' ? 'inline' : 'none';
  document.getElementById('badge-modo-dist-margen').style.display  = _modoDistribuidor === 'margen' ? 'inline' : 'none';
  document.getElementById('badge-modo-dist-precio').style.display  = _modoDistribuidor === 'precio' ? 'inline' : 'none';
  document.getElementById('grupo-margen-consumidor').classList.toggle('precio-campo-activo',  _modoConsumidor   === 'margen');
  document.getElementById('grupo-precio-final').classList.toggle('precio-campo-activo',       _modoConsumidor   === 'precio');
  document.getElementById('grupo-margen-distribuidor').classList.toggle('precio-campo-activo',_modoDistribuidor === 'margen');
  document.getElementById('grupo-precio-distribuidor').classList.toggle('precio-campo-activo',_modoDistribuidor === 'precio');
}

function _setSilently(id, val) { var el = document.getElementById(id); if (el) el.value = val; }

function _mostrarConfigGlobal() {
  var cfg = getConfig();
  document.getElementById('cfg-margen-consumidor-label').textContent   = 'global: ' + cfg.margenGlobalConsumidor + '%';
  document.getElementById('cfg-margen-distribuidor-label').textContent = 'global: ' + cfg.margenGlobalDistribuidor + '%';
}

// ── Render lista de productos (agrupado por categoría, con markup informativo)

function renderProductosList() {
  var q     = (document.getElementById('buscador-productos').value || '').toLowerCase().trim();
  var todos = getProductos().slice();
  var lista = q ? todos.filter(function(p) {
    return p.nombre.toLowerCase().indexOf(q) >= 0 ||
           (p.categoria || '').toLowerCase().indexOf(q) >= 0 ||
           (p.sku || '').toLowerCase().indexOf(q) >= 0;
  }) : todos;

  var wrapper  = document.getElementById('tabla-productos-wrapper');
  var contador = document.getElementById('contador-productos');
  contador.textContent = todos.length + (todos.length === 1 ? ' producto' : ' productos');

  if (lista.length === 0) {
    wrapper.innerHTML = q ? '<p class="tabla-vacia">Sin resultados.</p>' : '<p class="tabla-vacia">No hay productos registrados.</p>';
    return;
  }

  // Agrupar por categoría, ordenar
  var grupos = {};
  lista.forEach(function(p) { var cat = (p.categoria || '').trim() || 'Sin categoría'; if (!grupos[cat]) grupos[cat] = []; grupos[cat].push(p); });
  Object.keys(grupos).forEach(function(cat) { grupos[cat].sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }); });
  var catOrdenadas = Object.keys(grupos).sort(function(a, b) {
    if (a === 'Sin categoría') return 1; if (b === 'Sin categoría') return -1; return a.localeCompare(b, 'es');
  });

  var table = document.createElement('table');
  table.className = 'tabla tabla-productos';
  table.innerHTML =
    '<thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th>' +
    '<th class="td-num">Costo</th><th class="td-num">Margen</th><th class="td-num">Markup</th>' +
    '<th class="td-num">P. Consumidor</th><th class="td-num">P. Distribuidor</th>' +
    '<th></th></tr></thead>';

  var tbody = document.createElement('tbody');
  catOrdenadas.forEach(function(cat) {
    var trCat = document.createElement('tr');
    trCat.className = 'fila-categoria';
    trCat.innerHTML = '<td colspan="9" class="td-categoria-header">' + escapar(cat) + ' <span class="badge-cat-count">' + grupos[cat].length + '</span></td>';
    tbody.appendChild(trCat);

    grupos[cat].forEach(function(p) {
      var costoStr = '-', margenStr = '-', markupStr = '-', precioStr = '-', distribStr = '-';
      var margenClass = '';
      try {
        var r = calcularResumen(p, window.AppData.insumos);
        costoStr  = 'ARS ' + formatNum(r.costoTotal);
        margenStr = formatNum(r.margenConsumidor) + '%';
        markupStr = formatNum(r.markup) + '%';
        precioStr = 'ARS ' + formatNum(r.precioFinal);
        distribStr = r.precioDistribuidor > 0 ? 'ARS ' + formatNum(r.precioDistribuidor) : '-';
        if (r.margenConsumidor >= 50) margenClass = 'margen-excelente';
        else if (r.margenConsumidor >= 40) margenClass = 'margen-aceptable';
        else if (r.margenConsumidor > 0) margenClass = 'margen-bajo';
      } catch(e) {}

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="sku-tag sku-tag-clickable" onclick="copiarSKU(\'' + escapar(p.sku || '') + '\')" title="Clic para copiar">' + escapar(p.sku || '-') + '</span></td>' +
        '<td>' + escapar(p.nombre) + '</td>' +
        '<td class="td-categoria">' + escapar(p.categoria || '-') + '</td>' +
        '<td class="td-num">' + costoStr + '</td>' +
        '<td class="td-num ' + margenClass + '">' + margenStr + '</td>' +
        '<td class="td-num">' + markupStr + '</td>' +
        '<td class="td-num td-costo">' + precioStr + '</td>' +
        '<td class="td-num">' + distribStr + '</td>' +
        '<td class="td-acciones"><div class="menu-acciones">' +
          '<button class="btn-menu" onclick="toggleMenuProducto(event, \'' + p.id + '\')" aria-label="Acciones">⋮</button>' +
          '<div class="menu-dropdown" id="menu-prod-' + p.id + '" style="display:none;">' +
            '<button class="menu-item" onclick="abrirModalCostos(\'' + p.id + '\'); ocultarMenuProducto(\'' + p.id + '\')">💰 Costos</button>' +
            '<button class="menu-item" onclick="abrirEdicionProducto(\'' + p.id + '\'); ocultarMenuProducto(\'' + p.id + '\')">✏️ Editar</button>' +
            '<button class="menu-item" onclick="duplicarProducto(\'' + p.id + '\'); ocultarMenuProducto(\'' + p.id + '\')">📋 Duplicar</button>' +
            '<button class="menu-item menu-item-danger" onclick="confirmarEliminarProducto(\'' + p.id + '\', \'' + escapar(p.nombre) + '\'); ocultarMenuProducto(\'' + p.id + '\')">🗑️ Eliminar</button>' +
          '</div></div></td>';
      tbody.appendChild(tr);
    });
  });
  table.appendChild(tbody);
  wrapper.innerHTML = '';
  wrapper.appendChild(table);
}

// ── Copiar SKU ──────────────────────────────────────────────────────────────

function copiarSKU(sku) {
  if (!sku || sku === '-') return;
  navigator.clipboard.writeText(sku).then(mostrarToastCopiado).catch(function() {
    var ta = document.createElement('textarea'); ta.value = sku; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); mostrarToastCopiado(); } catch(e) {}
    document.body.removeChild(ta);
  });
}
function mostrarToastCopiado() {
  var t = document.getElementById('toast-copiado'); t.classList.add('visible');
  setTimeout(function() { t.classList.remove('visible'); }, 2000);
}

// ── Líneas de insumos (temp) ────────────────────────────────────────────────

function renderLineasTemp() {
  var wrapper = document.getElementById('lineas-insumos-wrapper');
  if (lineasTemp.length === 0) { wrapper.innerHTML = '<p class="tabla-vacia" style="padding:.75rem 0">Sin insumos agregados.</p>'; recalcularDesdeForm(); return; }
  var table = document.createElement('table'); table.className = 'tabla tabla-lineas';
  table.innerHTML = '<thead><tr><th>Insumo</th><th class="td-num">Cantidad</th><th>Unidad</th><th>Acción</th></tr></thead>';
  var tbody = document.createElement('tbody');
  lineasTemp.forEach(function(l, i) {
    var ins = window.AppData.insumos.find(function(x) { return x.id === l.insumoId; });
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + (ins ? escapar(ins.nombre) : '(eliminado)') + '</td><td class="td-num td-cantidad-edit"></td><td>' + (ins ? escapar(ins.unidad) : '') + '</td><td class="td-acciones"></td>';
    var inp = document.createElement('input'); inp.type = 'number'; inp.className = 'input-cant-inline'; inp.min = '0.001'; inp.step = 'any'; inp.value = fmtN(l.cantidad);
    inp.oninput = (function(idx) { return function() { var v = parseFloat(this.value); if (!isNaN(v) && v > 0) { lineasTemp[idx].cantidad = v; recalcularDesdeForm(); } }; })(i);
    tr.querySelector('.td-cantidad-edit').appendChild(inp);
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-sm btn-danger'; btn.textContent = 'Quitar';
    btn.onclick = (function(idx) { return function() { handleEliminarLineaTemp(idx); }; })(i);
    tr.querySelector('.td-acciones').appendChild(btn);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrapper.innerHTML = ''; wrapper.appendChild(table); recalcularDesdeForm();
}
function handleEliminarLineaTemp(i) { lineasTemp.splice(i, 1); renderLineasTemp(); }

// Dropdown de insumos
var _insumosParaDropdown = []; var _ddCursor = -1;
function poblarDropdownInsumos() { _insumosParaDropdown = window.AppData.insumos.slice(); var id = document.getElementById('campo-linea-insumo').value; if (id && !_insumosParaDropdown.find(function(x){ return x.id === id; })) { document.getElementById('campo-linea-insumo').value = ''; document.getElementById('campo-linea-insumo-texto').value = ''; } }
function filtrarDropdownInsumos(q) { var dd = document.getElementById('insumo-dropdown'); if (!dd) return; var query = (q||'').toLowerCase().trim(); var lista = query ? _insumosParaDropdown.filter(function(ins) { return ins.nombre.toLowerCase().indexOf(query) >= 0; }) : _insumosParaDropdown; dd.innerHTML = ''; if (lista.length === 0) { var em = document.createElement('div'); em.className = 'insumo-dd-item insumo-dd-empty'; em.textContent = 'Sin resultados'; dd.appendChild(em); } else { lista.forEach(function(ins) { var item = document.createElement('div'); item.className = 'insumo-dd-item'; item.textContent = ins.nombre + ' (' + ins.unidad + ')'; item.dataset.id = ins.id; item.dataset.nom = ins.nombre + ' (' + ins.unidad + ')'; item.onmousedown = function(e) { e.preventDefault(); seleccionarInsumoDropdown(ins.id, ins.nombre + ' (' + ins.unidad + ')'); }; dd.appendChild(item); }); } dd.style.display = 'block'; _resaltarDropdown(-1); }
function cerrarDropdownInsumos() { setTimeout(function() { var dd = document.getElementById('insumo-dropdown'); if (dd) dd.style.display = 'none'; }, 150); }
function seleccionarInsumoDropdown(id, txt) { document.getElementById('campo-linea-insumo').value = id; document.getElementById('campo-linea-insumo-texto').value = txt; var dd = document.getElementById('insumo-dropdown'); if (dd) dd.style.display = 'none'; document.getElementById('campo-linea-cantidad').focus(); }
function _resaltarDropdown(idx) { _ddCursor = idx; document.querySelectorAll('#insumo-dropdown .insumo-dd-item:not(.insumo-dd-empty)').forEach(function(el, i) { el.classList.toggle('insumo-dd-activo', i === idx); }); }
function handleInsumoKeydown(e) { var items = document.querySelectorAll('#insumo-dropdown .insumo-dd-item:not(.insumo-dd-empty)'); if (e.key === 'ArrowDown') { e.preventDefault(); _resaltarDropdown(Math.min(_ddCursor + 1, items.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); _resaltarDropdown(Math.max(_ddCursor - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); if (_ddCursor >= 0 && items[_ddCursor]) seleccionarInsumoDropdown(items[_ddCursor].dataset.id, items[_ddCursor].dataset.nom); else if (items.length === 1) seleccionarInsumoDropdown(items[0].dataset.id, items[0].dataset.nom); } }
function handleAgregarLinea() { ocultarErrorLineas(); var insumoId = document.getElementById('campo-linea-insumo').value; var cantidad = document.getElementById('campo-linea-cantidad').value; try { validarLineaInsumo(insumoId, cantidad); var ex = lineasTemp.find(function(l) { return l.insumoId === insumoId; }); if (ex) ex.cantidad = parseFloat(cantidad); else lineasTemp.push({ insumoId: insumoId, cantidad: parseFloat(cantidad) }); document.getElementById('campo-linea-insumo').value = ''; document.getElementById('campo-linea-insumo-texto').value = ''; document.getElementById('campo-linea-cantidad').value = ''; var dd = document.getElementById('insumo-dropdown'); if (dd) dd.style.display = 'none'; renderLineasTemp(); } catch(err) { mostrarErrorLineas(err.message); } }

// ── Modal de COSTOS ─────────────────────────────────────────────────────────

function abrirModalCostos(id) {
  var p = getProductoPorId(id); if (!p) return;
  var r; try { r = calcularResumen(p, window.AppData.insumos); } catch(e) { r = null; }
  document.getElementById('modal-costos-titulo').textContent = p.nombre;

  var recetaHTML = '';
  if (p.insumos && p.insumos.length > 0) {
    recetaHTML = '<table class="tabla tabla-receta-costos"><thead><tr><th>Insumo</th><th class="td-num">Cantidad</th><th>Unidad</th><th class="td-num">Costo unit.</th><th class="td-num">Subtotal</th></tr></thead><tbody>';
    p.insumos.forEach(function(linea) {
      var ins = window.AppData.insumos.find(function(x) { return x.id === linea.insumoId; });
      var cu = ins ? ins.costoUnitario : 0;
      recetaHTML += '<tr><td>' + (ins ? escapar(ins.nombre) : '(eliminado)') + '</td><td class="td-num">' + fmtN(linea.cantidad) + '</td><td>' + (ins ? escapar(ins.unidad) : '') + '</td><td class="td-num">ARS ' + formatNum(cu) + '</td><td class="td-num">ARS ' + formatNum(linea.cantidad * cu) + '</td></tr>';
    });
    recetaHTML += '</tbody></table>';
  } else { recetaHTML = '<p class="tabla-vacia">Sin insumos en la receta.</p>'; }
  document.getElementById('modal-costos-receta').innerHTML = recetaHTML;

  if (r) {
    document.getElementById('mc-costo-materiales').textContent = 'ARS ' + formatNum(r.costoMateriales);
    document.getElementById('mc-costo-mano-obra').textContent  = 'ARS ' + formatNum(r.costoManoObra);
    document.getElementById('mc-costo-total').textContent       = 'ARS ' + formatNum(r.costoTotal);
    document.getElementById('mc-margen').textContent            = formatNum(r.margenConsumidor) + '%';
    var mkEl = document.getElementById('mc-markup');
    mkEl.textContent = formatNum(r.markup) + '%';
    document.getElementById('mc-precio-final').textContent      = 'ARS ' + formatNum(r.precioFinal);
    document.getElementById('mc-ganancia').textContent          = 'ARS ' + formatNum(r.ganancia);
    document.getElementById('mc-desc-distrib').textContent      = r.margenDistribuidor > 0 ? formatNum(r.margenDistribuidor) + '%' : '-';
    document.getElementById('mc-precio-distrib').textContent    = r.precioDistribuidor > 0 ? 'ARS ' + formatNum(r.precioDistribuidor) : '-';
  }
  document.getElementById('modal-costos').classList.add('activo');
}
function cerrarModalCostos() { document.getElementById('modal-costos').classList.remove('activo'); }
function cerrarModalCostosOverlay(e) { if (e.target === document.getElementById('modal-costos')) cerrarModalCostos(); }
function verCostos(id) { abrirModalCostos(id); }
function mostrarPanelCostos() {} function ocultarPanelCostos() {}

// ── Modal de producto (nuevo/editar) ────────────────────────────────────────

function abrirModalProducto() { limpiarFormularioProducto(); document.getElementById('modal-producto').classList.add('activo'); document.getElementById('campo-producto-nombre').focus(); }
function cerrarModalProducto() { document.getElementById('modal-producto').classList.remove('activo'); limpiarFormularioProducto(); ocultarErrorProducto(); ocultarErrorLineas(); }
function cerrarModalProductoOverlay(e) { if (e.target === document.getElementById('modal-producto')) cerrarModalProducto(); }

function bindFormProducto() {
  document.getElementById('form-producto').addEventListener('submit', function(e) {
    e.preventDefault(); ocultarErrorProducto();
    var id = document.getElementById('campo-producto-id').value;
    var campos = leerFormularioProducto();
    try {
      if (id) { campos.insumos = lineasTemp; actualizarProducto(id, campos); }
      else { var p = crearProducto(campos); p.insumos = lineasTemp; agregarProducto(p); }
      cerrarModalProducto(); renderProductosList();
    } catch(err) { mostrarErrorProducto(err.message); }
  });
}

function leerFormularioProducto() {
  return { nombre: document.getElementById('campo-producto-nombre').value, sku: document.getElementById('campo-sku').value, categoria: document.getElementById('campo-producto-categoria').value, horasTrabajo: document.getElementById('campo-producto-horas').value, costoHora: document.getElementById('campo-producto-costo-hora').value, modoConsumidor: _modoConsumidor, margenConsumidor: document.getElementById('campo-margen-consumidor').value, precioFinal: document.getElementById('campo-precio-final').value, modoDistribuidor: _modoDistribuidor, margenDistribuidor: document.getElementById('campo-margen-distribuidor').value, precioDistribuidor: document.getElementById('campo-precio-distribuidor').value };
}

function abrirEdicionProducto(id) {
  var p = getProductoPorId(id); if (!p) return;
  document.getElementById('modal-producto').classList.add('activo');
  document.getElementById('campo-producto-id').value = p.id; document.getElementById('campo-producto-nombre').value = p.nombre;
  document.getElementById('campo-sku').value = p.sku || ''; document.getElementById('campo-producto-categoria').value = p.categoria || '';
  document.getElementById('campo-producto-horas').value = p.horasTrabajo; document.getElementById('campo-producto-costo-hora').value = p.costoHora;
  _modoConsumidor = p.modoConsumidor || 'margen'; _modoDistribuidor = p.modoDistribuidor || 'margen';
  var cfg = getConfig();
  document.getElementById('campo-margen-consumidor').value = fmtN(p.margenConsumidor != null ? p.margenConsumidor : p.margenDeseado != null ? p.margenDeseado : cfg.margenGlobalConsumidor);
  document.getElementById('campo-precio-final').value = p.precioFinal > 0 ? fmtN(p.precioFinal) : '';
  document.getElementById('campo-margen-distribuidor').value = fmtN(p.margenDistribuidor != null ? p.margenDistribuidor : cfg.margenGlobalDistribuidor);
  document.getElementById('campo-precio-distribuidor').value = p.precioDistribuidor > 0 ? fmtN(p.precioDistribuidor) : '';
  _badges(); lineasTemp = p.insumos.map(function(l) { return { insumoId: l.insumoId, cantidad: l.cantidad }; });
  document.getElementById('form-producto-titulo').textContent = 'Editar producto'; document.getElementById('btn-guardar-producto').textContent = 'Actualizar producto';
  poblarDropdownInsumos(); renderLineasTemp(); ocultarErrorProducto(); ocultarErrorLineas();
}

function limpiarFormularioProducto() {
  document.getElementById('form-producto').reset(); document.getElementById('campo-producto-id').value = ''; document.getElementById('campo-sku').value = '';
  var cfg = getConfig(); _modoConsumidor = 'margen'; _modoDistribuidor = 'margen';
  document.getElementById('campo-margen-consumidor').value = cfg.margenGlobalConsumidor; document.getElementById('campo-precio-final').value = '';
  document.getElementById('campo-margen-distribuidor').value = cfg.margenGlobalDistribuidor; document.getElementById('campo-precio-distribuidor').value = '';
  _badges(); document.getElementById('hint-consumidor').textContent = ''; document.getElementById('hint-distribuidor').textContent = '';
  var mkEl = document.getElementById('markup-info-valor'); if (mkEl) mkEl.textContent = '—';
  document.getElementById('form-producto-titulo').textContent = 'Nuevo producto'; document.getElementById('btn-guardar-producto').textContent = 'Guardar producto';
  lineasTemp = []; renderLineasTemp();
}

function duplicarProducto(id) {
  var o = getProductoPorId(id); if (!o) return;
  var c = crearProducto({ nombre: 'Copia de ' + o.nombre, sku: '', categoria: o.categoria || '', horasTrabajo: o.horasTrabajo, costoHora: o.costoHora, modoConsumidor: o.modoConsumidor || 'margen', margenConsumidor: o.margenConsumidor, precioFinal: o.precioFinal || 0, modoDistribuidor: o.modoDistribuidor || 'margen', margenDistribuidor: o.margenDistribuidor, precioDistribuidor: o.precioDistribuidor || 0 });
  c.insumos = o.insumos.map(function(l) { return { insumoId: l.insumoId, cantidad: l.cantidad }; });
  agregarProducto(c); renderProductosList(); abrirEdicionProducto(c.id);
}
function confirmarEliminarProducto(id, nombre) { if (!confirm('Eliminar "' + nombre + '"?')) return; eliminarProducto(id); renderProductosList(); }

// ── Modal exportar ──────────────────────────────────────────────────────────

function abrirModalExportar() {
  var lista = getProductos(); if (lista.length === 0) { alert('No hay productos para exportar.'); return; }
  var categorias = {}; lista.forEach(function(p) { var cat = (p.categoria || '').trim() || 'Sin categoría'; categorias[cat] = (categorias[cat] || 0) + 1; });
  var catOrd = Object.keys(categorias).sort(function(a, b) { if (a === 'Sin categoría') return 1; if (b === 'Sin categoría') return -1; return a.localeCompare(b, 'es'); });
  document.getElementById('export-categorias-list').innerHTML = catOrd.map(function(c) { return '<label class="export-cb-label"><input type="checkbox" class="cb-export-cat" value="' + escapar(c) + '" checked>' + escapar(c) + ' <span class="badge-cat-count">' + categorias[c] + '</span></label>'; }).join('');
  document.getElementById('export-productos-list').innerHTML = catOrd.map(function(cat) { var prods = lista.filter(function(p) { return ((p.categoria || '').trim() || 'Sin categoría') === cat; }).sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }); return '<div class="export-cat-grupo"><strong>' + escapar(cat) + '</strong>' + prods.map(function(p) { return '<label class="export-cb-label"><input type="checkbox" class="cb-export-prod" value="' + escapar(p.id) + '" checked><span class="sku-tag">' + escapar(p.sku || '-') + '</span> ' + escapar(p.nombre) + '</label>'; }).join('') + '</div>'; }).join('');
  document.getElementById('export-alcance').value = 'todos'; document.getElementById('export-moneda').value = 'ARS'; document.getElementById('export-cliente').value = '';
  _actualizarExportSeleccion(); _actualizarExportDolar();
  document.getElementById('modal-exportar').classList.add('activo');
}
function _actualizarExportSeleccion() { var a = document.getElementById('export-alcance').value; document.getElementById('export-categorias-wrapper').classList.toggle('oculto', a !== 'categorias'); document.getElementById('export-productos-wrapper').classList.toggle('oculto', a !== 'seleccion'); }
function _actualizarExportDolar() { var m = document.getElementById('export-moneda').value; var info = document.getElementById('export-dolar-info'); if (m === 'USD') { var d = getDolarCompra(); info.textContent = d > 0 ? 'Cotización dólar blue compra: $ ' + Number(d).toLocaleString('es-AR') : 'No hay cotización disponible.'; info.classList.remove('oculto'); } else { info.classList.add('oculto'); } }
function cerrarModalExportar(e) { if (!e || e.target === document.getElementById('modal-exportar')) document.getElementById('modal-exportar').classList.remove('activo'); }
function _getProductosParaExportar() { var a = document.getElementById('export-alcance').value; var ps = getProductos(); if (a === 'categorias') { var cs = Array.from(document.querySelectorAll('.cb-export-cat:checked')).map(function(cb) { return cb.value; }); return ps.filter(function(p) { return cs.indexOf((p.categoria || '').trim() || 'Sin categoría') >= 0; }); } if (a === 'seleccion') { var ids = Array.from(document.querySelectorAll('.cb-export-prod:checked')).map(function(cb) { return cb.value; }); return ps.filter(function(p) { return ids.indexOf(p.id) >= 0; }); } return ps; }
function ejecutarExportarExcel() { var ps = _getProductosParaExportar(); if (ps.length === 0) { alert('Seleccioná al menos un producto.'); return; } try { exportarListaPrecios(ps, window.AppData.insumos, { tipo: document.getElementById('export-tipo').value, moneda: document.getElementById('export-moneda').value, cliente: document.getElementById('export-cliente').value.trim(), dolarCompra: getDolarCompra() }); } catch(err) { alert('Error: ' + err.message); } }
function ejecutarExportarPDF() { var ps = _getProductosParaExportar(); if (ps.length === 0) { alert('Seleccioná al menos un producto.'); return; } try { exportarListaPreciosPDF(ps, window.AppData.insumos, { tipo: document.getElementById('export-tipo').value, moneda: document.getElementById('export-moneda').value, cliente: document.getElementById('export-cliente').value.trim(), dolarCompra: getDolarCompra() }); } catch(err) { alert('Error: ' + err.message); } }

// ── Edición masiva ──────────────────────────────────────────────────────────

function togglePanelMasivoP() { var b = document.getElementById('body-masivo-productos'); var h = document.getElementById('toggle-masivo-productos'); h.classList.toggle('abierto', b.classList.toggle('visible')); }
var _previstaProductos = [];
function previsualizarMasivoProductos() { var campo = document.getElementById('masivo-prod-campo').value; var modo = document.getElementById('masivo-prod-modo').value; var valor = parseFloat(document.getElementById('masivo-prod-valor').value); if (isNaN(valor)) { alert('Ingresá un valor numérico.'); return; } _previstaProductos = previsualizarAjusteProductos(window.AppData.productos, modo, valor, campo, window.AppData.insumos); var div = document.getElementById('masivo-prod-preview'); if (_previstaProductos.length === 0) { div.innerHTML = '<p class="tabla-vacia">No hay productos.</p>'; return; } var mD = campo === 'distribuidor' || campo === 'ambos'; var mM = campo === 'margen' || campo === 'ambos'; var filas = _previstaProductos.map(function(f) { var dP = f.precioConsumidorNuevo - f.precioConsumidorActual; var dD = f.precioDistribNuevo - f.precioDistribActual; var cP = dP > 0 ? 'delta-pos' : dP < 0 ? 'delta-neg' : 'delta-neu'; var cD = dD > 0 ? 'delta-pos' : dD < 0 ? 'delta-neg' : 'delta-neu'; return '<tr><td><input type="checkbox" class="cb-seleccion cb-producto" data-id="' + escapar(f.id) + '" checked></td><td><span class="sku-tag">' + escapar(f.sku) + '</span></td><td>' + escapar(f.nombre) + '</td>' + (mM ? '<td class="td-num">' + formatNum(f.margenActual) + '%</td><td class="td-num">' + formatNum(f.margenNuevo) + '%</td><td class="' + cP + '">' + (dP >= 0 ? '+' : '') + formatNum(dP) + '</td>' : '<td colspan="3" style="color:var(--text-3)">sin cambio</td>') + (mD ? '<td class="td-num">' + (f.precioDistribActual > 0 ? 'ARS ' + formatNum(f.precioDistribActual) : '-') + '</td><td class="td-num">' + (f.precioDistribNuevo > 0 ? 'ARS ' + formatNum(f.precioDistribNuevo) : '-') + '</td><td class="' + cD + '">' + (dD >= 0 ? '+' : '') + formatNum(dD) + '</td>' : '<td colspan="3" style="color:var(--text-3)">sin cambio</td>') + '</tr>'; }).join(''); div.innerHTML = '<table class="tabla tabla-preview" style="margin-top:.75rem;"><thead><tr><th></th><th>SKU</th><th>Producto</th>' + (mM ? '<th class="td-num">Margen act.</th><th class="td-num">Margen nuevo</th><th class="td-num">Delta P.Cons.</th>' : '<th colspan="3"></th>') + (mD ? '<th class="td-num">P.Dist. act.</th><th class="td-num">P.Dist. nuevo</th><th class="td-num">Delta</th>' : '<th colspan="3"></th>') + '</tr></thead><tbody>' + filas + '</tbody></table>'; document.getElementById('masivo-prod-acciones').style.display = 'block'; }
function seleccionarTodosProductos(est) { document.querySelectorAll('.cb-producto').forEach(function(cb) { cb.checked = est; }); }
function aplicarMasivoProductos() { var ids = Array.from(document.querySelectorAll('.cb-producto:checked')).map(function(cb) { return cb.dataset.id; }); if (ids.length === 0) { alert('Seleccioná al menos un producto.'); return; } var campo = document.getElementById('masivo-prod-campo').value; var modo = document.getElementById('masivo-prod-modo').value; var valor = parseFloat(document.getElementById('masivo-prod-valor').value); if (!confirm('Aplicar a ' + ids.length + ' producto(s)?')) return; aplicarAjusteProductos(ids, modo, valor, campo); limpiarMasivoProductos(); renderProductosList(); }
function limpiarMasivoProductos() { document.getElementById('masivo-prod-preview').innerHTML = ''; document.getElementById('masivo-prod-acciones').style.display = 'none'; document.getElementById('masivo-prod-valor').value = ''; _previstaProductos = []; }

// ── Helpers ─────────────────────────────────────────────────────────────────

function mostrarErrorProducto(msg) { var e = document.getElementById('form-producto-error'); e.textContent = msg; e.style.display = 'flex'; }
function ocultarErrorProducto() { document.getElementById('form-producto-error').style.display = 'none'; }
function mostrarErrorLineas(msg) { var e = document.getElementById('lineas-insumos-error'); e.textContent = msg; e.style.display = 'flex'; }
function ocultarErrorLineas() { document.getElementById('lineas-insumos-error').style.display = 'none'; }
function formatNum(n) { return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtN(n) { var v = Number(n); return isNaN(v) ? '' : String(Math.round(v * 10000) / 10000); }
function escapar(str) { return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function handleImport(event) { var f = event.target.files[0]; if (!f) return; importData(f).then(function() { alert('Importado.'); location.reload(); }).catch(function(e) { alert(e.message); }); }
function toggleMenuProducto(event, id) { event.stopPropagation(); var m = document.getElementById('menu-prod-' + id); var open = m.style.display === 'block'; document.querySelectorAll('.menu-dropdown').forEach(function(x) { x.style.display = 'none'; }); m.style.display = open ? 'none' : 'block'; }
function ocultarMenuProducto(id) { var m = document.getElementById('menu-prod-' + id); if (m) m.style.display = 'none'; }
document.addEventListener('click', function() { document.querySelectorAll('.menu-dropdown').forEach(function(m) { m.style.display = 'none'; }); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { var m1 = document.getElementById('modal-producto'); if (m1 && m1.classList.contains('activo')) { cerrarModalProducto(); return; } var m2 = document.getElementById('modal-costos'); if (m2 && m2.classList.contains('activo')) { cerrarModalCostos(); return; } var m3 = document.getElementById('modal-exportar'); if (m3 && m3.classList.contains('activo')) cerrarModalExportar(); } });
