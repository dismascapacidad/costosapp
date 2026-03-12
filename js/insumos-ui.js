// insumos-ui.js - UI del módulo de insumos
// Cargado después de app.js e insumos.js

// ── Dolar widget ────────────────────────────────────────────────────────────

function renderDolarWidget(registro) {
  var ventaEl  = document.getElementById('dolar-valor-venta');
  var compraEl = document.getElementById('dolar-valor-compra');
  var fechaEl  = document.getElementById('dolar-fecha');
  var fuenteEl = document.getElementById('dolar-fuente');
  var widget   = document.getElementById('dolar-widget');
  if (!registro) { if (ventaEl) ventaEl.textContent = '—'; if (compraEl) compraEl.textContent = '—'; fechaEl.textContent = ''; return; }
  if (ventaEl)  ventaEl.textContent  = '$ ' + Number(registro.venta || registro.valor || 0).toLocaleString('es-AR');
  if (compraEl) compraEl.textContent = '$ ' + Number(registro.compra || registro.valor || 0).toLocaleString('es-AR');
  if (registro.fuente === 'api') {
    fuenteEl.textContent = '● EN VIVO'; fuenteEl.className = 'dolar-fuente dolar-live'; fechaEl.textContent = ''; widget.classList.remove('dolar-stale');
  } else {
    fuenteEl.textContent = '● CACHÉ'; fuenteEl.className = 'dolar-fuente dolar-cached';
    fechaEl.textContent = registro.fecha ? 'Última actualización: ' + formatearAntiguedad(registro.fecha) + ' — puede estar desactualizado' : 'Sin conexión — usando valor manual';
    widget.classList.add('dolar-stale');
  }
}

function actualizarDolar() {
  var btn = document.getElementById('btn-dolar-refresh');
  btn.disabled = true; btn.textContent = '↻ Actualizando…';
  fetchDolarBlue().then(function(reg) {
    renderDolarWidget(reg);
    window.AppData.insumos.forEach(function(ins) {
      if (ins.moneda === 'USD') {
        ins.costoUnitario = calcularCostoUnitario(ins.precioCompra, ins.cantidadCompra, 'USD', window.AppData.tipoCambioManual);
      }
    });
    saveData(window.AppData);
    renderInsumosList();
  }).finally(function() { btn.disabled = false; btn.textContent = '↻ Actualizar'; });
}

// ── Render tabla ────────────────────────────────────────────────────────────

function renderInsumosList() {
  var query   = (document.getElementById('buscador-insumos').value || '').toLowerCase().trim();
  var todos   = getInsumos().slice().sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  var insumos = query
    ? todos.filter(function(i) { return i.nombre.toLowerCase().indexOf(query) >= 0 || (i.categoria || '').toLowerCase().indexOf(query) >= 0; })
    : todos;

  var wrapper  = document.getElementById('tabla-wrapper');
  var contador = document.getElementById('contador-insumos');
  contador.textContent = todos.length + (todos.length === 1 ? ' insumo' : ' insumos');

  if (insumos.length === 0) {
    wrapper.innerHTML = query ? '<p class="tabla-vacia">Sin resultados para esa búsqueda.</p>' : '<p class="tabla-vacia">No hay insumos registrados.</p>';
    return;
  }

  var tc = window.AppData.tipoCambioManual;

  var table = document.createElement('table');
  table.className = 'tabla tabla-insumos';
  table.innerHTML =
    '<thead><tr>' +
    '<th>Nombre</th><th>Categoría</th><th>Unidad</th>' +
    '<th class="td-num">Precio compra</th><th class="td-num">Cantidad</th>' +
    '<th class="td-num">Costo unitario (ARS)</th><th>Proveedor</th><th></th>' +
    '</tr></thead>';

  var tbody = document.createElement('tbody');
  insumos.forEach(function(ins) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapar(ins.nombre) + '</td>' +
      '<td>' + (escapar(ins.categoria) || '—') + '</td>' +
      '<td>' + escapar(ins.unidad) + '</td>' +
      '<td class="td-num">' + ins.moneda + ' ' + formatNum(ins.precioCompra) + '</td>' +
      '<td class="td-num">' + formatNum(ins.cantidadCompra) + '</td>' +
      '<td class="td-num td-costo">ARS ' + formatNum(ins.costoUnitario) + '</td>' +
      '<td>' + (escapar(ins.proveedor) || '—') + '</td>' +
      '<td class="td-acciones">' +
        '<div class="menu-acciones">' +
          '<button class="btn-menu" onclick="toggleMenu(event, \'' + ins.id + '\')" aria-label="Acciones">⋮</button>' +
          '<div class="menu-dropdown" id="menu-' + ins.id + '" style="display:none;">' +
            '<button class="menu-item" onclick="abrirModalDetalle(\'' + ins.id + '\'); cerrarMenus();">📋 Detalle</button>' +
            '<button class="menu-item" onclick="abrirEdicion(\'' + ins.id + '\'); cerrarMenus();">✏️ Editar</button>' +
            '<button class="menu-item" onclick="duplicarInsumo(\'' + ins.id + '\'); cerrarMenus();">📋 Duplicar</button>' +
            '<button class="menu-item menu-item-danger" onclick="confirmarEliminar(\'' + ins.id + '\',\'' + escapar(ins.nombre) + '\'); cerrarMenus();">🗑️ Eliminar</button>' +
          '</div>' +
        '</div>' +
      '</td>';
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrapper.innerHTML = '';
  wrapper.appendChild(table);

  var nota = document.createElement('p');
  nota.className = 'tabla-nota';
  nota.textContent = 'Tipo de cambio aplicado: 1 USD = ARS ' + formatNum(tc);
  wrapper.appendChild(nota);
}

// ── Menú de acciones (patrón estándar) ──────────────────────────────────────

function toggleMenu(event, id) {
  event.stopPropagation();
  var menu = document.getElementById('menu-' + id);
  var abierto = menu.style.display === 'block';
  cerrarMenus();
  menu.style.display = abierto ? 'none' : 'block';
}

function cerrarMenus() {
  document.querySelectorAll('.menu-dropdown').forEach(function(m) { m.style.display = 'none'; });
}

document.addEventListener('click', cerrarMenus);

// ── Modal detalle ───────────────────────────────────────────────────────────

function abrirModalDetalle(id) {
  var ins = getInsumoPorId(id);
  if (!ins) return;
  document.getElementById('modal-detalle-titulo').textContent = ins.nombre;
  document.getElementById('md-categoria').textContent  = ins.categoria || '—';
  document.getElementById('md-unidad').textContent     = ins.unidad;
  document.getElementById('md-proveedor').textContent  = ins.proveedor || '—';
  document.getElementById('md-moneda').textContent     = ins.moneda;
  document.getElementById('md-precio').textContent     = ins.moneda + ' ' + formatNum(ins.precioCompra);
  document.getElementById('md-cantidad').textContent   = formatNum(ins.cantidadCompra) + ' ' + ins.unidad;
  document.getElementById('md-costo-unit').textContent = 'ARS ' + formatNum(ins.costoUnitario) + ' / ' + ins.unidad;
  document.getElementById('md-fecha').textContent      = ins.fechaActualizacion
    ? new Date(ins.fechaActualizacion).toLocaleDateString('es-AR') : '—';
  document.getElementById('modal-detalle-insumo').classList.add('activo');
}

function cerrarModalDetalle() { document.getElementById('modal-detalle-insumo').classList.remove('activo'); }
function cerrarModalDetalleOverlay(e) { if (e.target === document.getElementById('modal-detalle-insumo')) cerrarModalDetalle(); }

// ── Formulario ──────────────────────────────────────────────────────────────

function bindFormInsumo() {
  document.getElementById('form-insumo').addEventListener('submit', function(e) {
    e.preventDefault(); ocultarError();
    var id = document.getElementById('campo-id').value;
    var campos = leerFormulario();
    try {
      if (id) { actualizarInsumo(id, campos); }
      else    { agregarInsumo(crearInsumo(campos)); }
      limpiarFormulario(); renderInsumosList();
    } catch(err) { mostrarError(err.message); }
  });
}

function leerFormulario() {
  return {
    nombre:         document.getElementById('campo-nombre').value,
    categoria:      document.getElementById('campo-categoria').value,
    unidad:         document.getElementById('campo-unidad').value,
    moneda:         document.getElementById('campo-moneda').value,
    precioCompra:   document.getElementById('campo-precio').value,
    cantidadCompra: document.getElementById('campo-cantidad').value,
    proveedor:      document.getElementById('campo-proveedor').value
  };
}

function abrirEdicion(id) {
  var ins = getInsumoPorId(id); if (!ins) return;
  document.getElementById('campo-id').value        = ins.id;
  document.getElementById('campo-nombre').value    = ins.nombre;
  document.getElementById('campo-categoria').value = ins.categoria;
  document.getElementById('campo-unidad').value    = ins.unidad;
  document.getElementById('campo-moneda').value    = ins.moneda;
  document.getElementById('campo-precio').value    = ins.precioCompra;
  document.getElementById('campo-cantidad').value  = ins.cantidadCompra;
  document.getElementById('campo-proveedor').value = ins.proveedor;
  document.getElementById('form-titulo').textContent    = 'Editar insumo';
  document.getElementById('btn-guardar').textContent    = 'Actualizar insumo';
  document.getElementById('btn-cancelar').classList.remove('oculto');
  document.getElementById('card-form').scrollIntoView({ behavior: 'smooth' });
  ocultarError();
}

function cancelarEdicion() { limpiarFormulario(); ocultarError(); }

function limpiarFormulario() {
  document.getElementById('form-insumo').reset();
  document.getElementById('campo-id').value           = '';
  document.getElementById('form-titulo').textContent  = 'Nuevo insumo';
  document.getElementById('btn-guardar').textContent  = 'Guardar insumo';
  document.getElementById('btn-cancelar').classList.add('oculto');
}

function confirmarEliminar(id, nombre) {
  if (!confirm('¿Eliminar "' + nombre + '"?')) return;
  eliminarInsumo(id); renderInsumosList();
}

function duplicarInsumo(id) {
  var original = getInsumoPorId(id); if (!original) return;
  var copia = crearInsumo({
    nombre:         'Copia de ' + original.nombre,
    categoria:      original.categoria || '',
    unidad:         original.unidad,
    moneda:         original.moneda,
    precioCompra:   original.precioCompra,
    cantidadCompra: original.cantidadCompra,
    proveedor:      original.proveedor || ''
  });
  agregarInsumo(copia);
  renderInsumosList();
  abrirEdicion(copia.id);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mostrarError(msg) { var e = document.getElementById('form-error'); e.textContent = msg; e.classList.remove('oculto'); }
function ocultarError()    { document.getElementById('form-error').classList.add('oculto'); }
function formatNum(n)      { return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapar(str)      { return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function handleImport(event) {
  var file = event.target.files[0]; if (!file) return;
  importData(file).then(function() { alert('Datos importados.'); location.reload(); }).catch(function(err) { alert('Error: ' + err.message); });
}

// ── Edición masiva ──────────────────────────────────────────────────────────

function togglePanelMasivo(tipo) {
  var header = document.getElementById('toggle-masivo-' + tipo);
  var body   = document.getElementById('body-masivo-' + tipo);
  var abierto = body.classList.toggle('visible');
  header.classList.toggle('abierto', abierto);
}

var _previstaInsumos = [];

function previsualizarMasivoInsumos() {
  var modo  = document.getElementById('masivo-insumos-modo').value;
  var valor = parseFloat(document.getElementById('masivo-insumos-valor').value);
  if (isNaN(valor)) { alert('Ingresá un valor numérico.'); return; }
  _previstaInsumos = previsualizarAjusteInsumos(window.AppData.insumos, modo, valor);
  var div = document.getElementById('masivo-insumos-preview');
  if (_previstaInsumos.length === 0) { div.innerHTML = '<p class="tabla-vacia">No hay insumos.</p>'; return; }
  var filas = _previstaInsumos.map(function(f) {
    var deltaStr = (f.delta >= 0 ? '+' : '') + formatNum(f.delta);
    var cls = f.delta > 0 ? 'delta-pos' : f.delta < 0 ? 'delta-neg' : 'delta-neu';
    return '<tr>' +
      '<td><input type="checkbox" class="cb-seleccion cb-insumo" data-id="' + f.id + '" checked /></td>' +
      '<td>' + escapar(f.nombre) + '</td><td>' + escapar(f.unidad) + '</td>' +
      '<td class="td-num">ARS ' + formatNum(f.precioActual) + '</td>' +
      '<td class="td-num">ARS ' + formatNum(f.precioNuevo) + '</td>' +
      '<td class="' + cls + '">' + deltaStr + '</td></tr>';
  }).join('');
  div.innerHTML = '<table class="tabla tabla-preview" style="margin-top:0.75rem;"><thead><tr>' +
    '<th style="width:30px"></th><th>Insumo</th><th>Unidad</th>' +
    '<th class="td-num">Precio actual</th><th class="td-num">Precio nuevo</th><th class="td-num">Δ</th>' +
    '</tr></thead><tbody>' + filas + '</tbody></table>';
  document.getElementById('masivo-insumos-acciones').classList.remove('oculto');
}

function seleccionarTodosInsumos(estado) {
  document.querySelectorAll('.cb-insumo').forEach(function(cb) { cb.checked = estado; });
}

function aplicarMasivoInsumos() {
  var ids = Array.from(document.querySelectorAll('.cb-insumo:checked')).map(function(cb) { return cb.dataset.id; });
  if (ids.length === 0) { alert('Seleccioná al menos un insumo.'); return; }
  var modo  = document.getElementById('masivo-insumos-modo').value;
  var valor = parseFloat(document.getElementById('masivo-insumos-valor').value);
  if (!confirm('¿Aplicar el ajuste a ' + ids.length + ' insumo(s)? No se puede deshacer.')) return;
  aplicarAjusteInsumos(ids, modo, valor);
  limpiarMasivoInsumos(); renderInsumosList();
}

function limpiarMasivoInsumos() {
  document.getElementById('masivo-insumos-preview').innerHTML = '';
  document.getElementById('masivo-insumos-acciones').classList.add('oculto');
  document.getElementById('masivo-insumos-valor').value = '';
  _previstaInsumos = [];
}

// ── Arranque ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  var cache = getCacheDolar();
  renderDolarWidget(cache);
  fetchDolarBlue().then(renderDolarWidget);
});

// Cerrar modal con Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modal = document.getElementById('modal-detalle-insumo');
    if (modal && modal.classList.contains('activo')) cerrarModalDetalle();
  }
});
