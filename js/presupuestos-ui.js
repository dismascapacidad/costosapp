/**
 * presupuestos-ui.js
 * UI del módulo de presupuestos.
 * Toda la lógica de interfaz, eventos y renderizado.
 * Depende de: presupuestos.js (lógica de negocio), costos.js, clientes.js, exportar.js
 */

// =============================================================================
// Estado local del formulario
// =============================================================================

let lineasPresupTemp  = [];
let tipoClienteActual = 'consumidor';
let monedaActual      = 'ARS';
let tipoDolarActual   = 'blue';
let tipoCambioActual  = 0;
let _clientesParaDropdown = [];
let _ddClienteCursor = -1;
let _clienteSeleccionado = null;
let _productoPresupSeleccionado = null;
let _ddProductoCursor = -1;

// Referencia al menú abierto (para cerrar al hacer clic fuera)
let _menuPresupAbierto = null;

// =============================================================================
// Helpers
// =============================================================================

function formatNum(n) {
  return Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapar(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mostrarErrorPresup(msg) {
  var e = document.getElementById('form-presup-error');
  e.textContent = msg;
  e.classList.remove('oculto');
}

function ocultarErrorPresup() {
  document.getElementById('form-presup-error').classList.add('oculto');
}

function mostrarErrorLineasPresup(m) {
  var e = document.getElementById('lineas-presup-error');
  e.textContent = m;
  e.classList.remove('oculto');
}

function ocultarErrorLineasPresup() {
  document.getElementById('lineas-presup-error').classList.add('oculto');
}

// =============================================================================
// Widget dólar (igual en todas las páginas)
// =============================================================================

function renderDolarWidget(registro) {
  if (!registro) return;
  var ventaEl  = document.getElementById('dolar-valor-venta');
  var compraEl = document.getElementById('dolar-valor-compra');
  var fechaEl  = document.getElementById('dolar-fecha');
  var fuenteEl = document.getElementById('dolar-fuente');
  if (ventaEl)  ventaEl.textContent  = '$ ' + Number(registro.venta || registro.valor || 0).toLocaleString('es-AR');
  if (compraEl) compraEl.textContent = '$ ' + Number(registro.compra || registro.valor || 0).toLocaleString('es-AR');
  if (registro.fuente === 'api') {
    fuenteEl.textContent = '● EN VIVO';
    fuenteEl.className = 'dolar-fuente dolar-live';
    fechaEl.textContent  = '';
  } else {
    fuenteEl.textContent = '● CACHÉ';
    fuenteEl.className = 'dolar-fuente dolar-cached';
    fechaEl.textContent  = registro.fecha
      ? formatearAntiguedad(registro.fecha) + ' — puede estar desactualizado'
      : '';
  }
}

// =============================================================================
// Moneda del presupuesto
// =============================================================================

function _labelTipoDolar(tipo) {
  return tipo === 'oficial' ? 'Oficial' : tipo === 'divisa' ? 'Divisa' : 'Blue';
}

async function _fetchCotizacionDolar(tipo) {
  if (tipo === 'oficial') return fetchDolarOficial();
  if (tipo === 'divisa')  return fetchDolarDivisa();
  return fetchDolarBlue();
}

async function actualizarCotizacionSeleccionada() {
  if (monedaActual !== 'USD') return;
  var tipo = document.getElementById('campo-tipo-dolar').value;
  tipoDolarActual = tipo;
  var registro = await _fetchCotizacionDolar(tipo);
  tipoCambioActual = registro ? (registro.compra || 0) : 0;
  var display = document.getElementById('tipo-cambio-display');
  if (display) {
    display.textContent = tipoCambioActual > 0
      ? '1 USD = ARS ' + Number(tipoCambioActual).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (compra)'
      : 'Cotización no disponible';
  }
  recalcularTotales();
}

function setMoneda(moneda) {
  monedaActual = moneda;
  var btnARS = document.getElementById('btn-moneda-ars');
  var btnUSD = document.getElementById('btn-moneda-usd');
  var selectorDolar = document.getElementById('selector-tipo-dolar');

  btnARS.classList.toggle('activo', moneda === 'ARS');
  btnUSD.classList.toggle('activo', moneda === 'USD');

  if (moneda === 'USD') {
    selectorDolar.classList.remove('oculto');
    actualizarCotizacionSeleccionada();
  } else {
    selectorDolar.classList.add('oculto');
    tipoCambioActual = 0;
    recalcularTotales();
  }
}

// =============================================================================
// Autocompletado de clientes
// =============================================================================

function poblarDropdownClientesData() {
  if (typeof getClientes === 'function') {
    _clientesParaDropdown = getClientes();
  } else {
    _clientesParaDropdown = [];
    console.warn('[presupuestos] módulo clientes.js no cargado, autocompletado deshabilitado');
  }
}

function filtrarDropdownClientes(q) {
  var dropdown = document.getElementById('cliente-dropdown');
  if (!dropdown) return;

  var query = (q || '').toLowerCase().trim();

  if (query.length < 2) {
    dropdown.classList.add("oculto");
    return;
  }

  if (_clientesParaDropdown.length === 0) {
    dropdown.innerHTML =
      '<div class="cliente-dd-item cliente-dd-empty">' +
      'No hay clientes registrados.<br><small>Andá a Clientes para agregar</small></div>';
    dropdown.classList.remove("oculto");
    return;
  }

  var lista = query
    ? _clientesParaDropdown.filter(function(c) {
        return c.nombre.toLowerCase().indexOf(query) >= 0 ||
               (c.email || '').toLowerCase().indexOf(query) >= 0 ||
               (c.telefono || '').toLowerCase().indexOf(query) >= 0;
      })
    : _clientesParaDropdown;

  dropdown.innerHTML = '';
  if (lista.length === 0) {
    var em = document.createElement('div');
    em.className = 'cliente-dd-item cliente-dd-empty';
    em.innerHTML = 'Sin resultados<br><small>Podés crear el cliente en Clientes</small>';
    dropdown.appendChild(em);
  } else {
    lista.slice(0, 8).forEach(function(c) {
      var item = document.createElement('div');
      item.className = 'cliente-dd-item';
      var tipoIcon = c.tipo === 'distribuidor' ? '🏢' : '👤';
      var email = c.email ? '<br><small>' + escapar(c.email) + '</small>' : '';
      item.innerHTML = tipoIcon + ' <strong>' + escapar(c.nombre) + '</strong>' + email;
      item.dataset.id = c.id;
      item.onmousedown = function(e) {
        e.preventDefault();
        seleccionarClienteDropdown(c.id);
      };
      dropdown.appendChild(item);
    });
  }
  dropdown.classList.remove("oculto");
  _resaltarDropdownCliente(-1);
}

function cerrarDropdownClientes() {
  setTimeout(function() {
    var dd = document.getElementById('cliente-dropdown');
    if (dd) dd.classList.add("oculto");
  }, 150);
}

function seleccionarClienteDropdown(clienteId) {
  if (typeof getClientePorId !== 'function') {
    console.error('[presupuestos] getClientePorId no disponible');
    return;
  }

  var cliente = getClientePorId(clienteId);
  if (!cliente) return;

  _clienteSeleccionado = cliente;

  document.getElementById('campo-cliente-id').value = cliente.id;
  document.getElementById('campo-cliente-nombre').value = cliente.nombre;
  document.getElementById('campo-cliente-texto').value = cliente.nombre;

  var card = document.getElementById('cliente-info-card');
  card.classList.remove("oculto");
  document.getElementById('cliente-info-nombre-display').textContent = cliente.nombre;
  document.getElementById('cliente-info-email').textContent = cliente.email || 'Sin email';
  document.getElementById('cliente-info-telefono').textContent = cliente.telefono || 'Sin teléfono';

  var tipoTag = cliente.tipo === 'distribuidor'
    ? '<span class="tipo-tag distribuidor">Distribuidor</span>'
    : '<span class="tipo-tag consumidor">Consumidor</span>';
  document.getElementById('cliente-info-tipo-tag').innerHTML = tipoTag;

  setTipoCliente(cliente.tipo || 'consumidor');

  var dd = document.getElementById('cliente-dropdown');
  if (dd) dd.classList.add("oculto");

  recalcularTotales();
}

function limpiarClienteSeleccionado() {
  _clienteSeleccionado = null;
  document.getElementById('campo-cliente-id').value = '';
  document.getElementById('campo-cliente-nombre').value = '';
  document.getElementById('campo-cliente-texto').value = '';
  document.getElementById('cliente-info-card').classList.add('oculto');
  document.getElementById('campo-cliente-texto').focus();
  recalcularTotales();
}

function _resaltarDropdownCliente(idx) {
  _ddClienteCursor = idx;
  var items = document.querySelectorAll('#cliente-dropdown .cliente-dd-item:not(.cliente-dd-empty)');
  items.forEach(function(el, i) {
    el.classList.toggle('cliente-dd-activo', i === idx);
  });
}

function handleClienteKeydown(e) {
  var items = document.querySelectorAll('#cliente-dropdown .cliente-dd-item:not(.cliente-dd-empty)');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _resaltarDropdownCliente(Math.min(_ddClienteCursor + 1, items.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _resaltarDropdownCliente(Math.max(_ddClienteCursor - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_ddClienteCursor >= 0 && items[_ddClienteCursor]) {
      seleccionarClienteDropdown(items[_ddClienteCursor].dataset.id);
    } else if (items.length === 1) {
      seleccionarClienteDropdown(items[0].dataset.id);
    }
  } else if (e.key === 'Escape') {
    cerrarDropdownClientes();
  }
}

// =============================================================================
// Tipo de cliente
// =============================================================================

function setTipoCliente(tipo) {
  tipoClienteActual = tipo;
  document.getElementById('btn-tipo-consumidor').classList.toggle('activo', tipo === 'consumidor');
  document.getElementById('btn-tipo-distribuidor').classList.toggle('activo', tipo === 'distribuidor');
  lineasPresupTemp = lineasPresupTemp.map(function(l) {
    try {
      var precioUnitario = resolverPrecioUnitario(
        l.productoId, tipoClienteActual,
        window.AppData.productos, window.AppData.insumos
      );
      return Object.assign({}, l, { precioUnitario: precioUnitario, subtotal: l.cantidad * precioUnitario });
    } catch (_) { return l; }
  });
  renderLineasPresup();
  recalcularTotales();
}

// =============================================================================
// Buscador de productos — muestra TODOS al hacer focus, filtra al escribir
// =============================================================================

function filtrarProductosPresup(query) {
  var dropdown = document.getElementById('producto-dropdown-presup');
  var q = (query || '').toLowerCase().trim();
  var productos = window.AppData.productos || [];

  // Sin query: mostrar todos los productos
  if (q.length === 0) {
    _renderProductoDropdown(dropdown, productos);
    return;
  }

  // Con query: filtrar
  var resultados = productos.filter(function(p) {
    return (p.nombre || '').toLowerCase().indexOf(q) >= 0 ||
           (p.sku || '').toLowerCase().indexOf(q) >= 0;
  });

  _renderProductoDropdown(dropdown, resultados);
}

function _renderProductoDropdown(dropdown, resultados) {
  if (resultados.length === 0) {
    dropdown.innerHTML = '<div class="producto-dd-empty">No se encontraron productos</div>';
    dropdown.classList.add('visible');
    _ddProductoCursor = -1;
    return;
  }

  // Limitar a 15 resultados para no sobrecargar
  var lista = resultados.slice(0, 15);

  dropdown.innerHTML = lista.map(function(p, i) {
    var sku = p.sku ? '<span class="sku">[' + escapar(p.sku) + ']</span>' : '';
    var precio = 0;
    try {
      precio = resolverPrecioUnitario(p.id, tipoClienteActual, window.AppData.productos, window.AppData.insumos);
    } catch(e) {}
    var precioStr = '<span class="precio">ARS ' + formatNum(precio) + '</span>';
    return '<div class="producto-dd-item" data-id="' + p.id + '" data-index="' + i + '">' +
      sku + '<span class="producto-dd-nombre">' + escapar(p.nombre) + '</span>' + precioStr + '</div>';
  }).join('');

  dropdown.classList.add('visible');
  _ddProductoCursor = -1;

  // Agregar event listeners (mousedown para no perder focus)
  dropdown.querySelectorAll('.producto-dd-item').forEach(function(el) {
    el.addEventListener('mousedown', function(e) {
      e.preventDefault();
      seleccionarProductoPresup(el.getAttribute('data-id'));
    });
  });
}

function seleccionarProductoPresup(productoId) {
  var p = window.AppData.productos.find(function(x) { return x.id === productoId; });
  if (!p) return;

  _productoPresupSeleccionado = p;
  document.getElementById('campo-presup-producto-id').value = p.id;
  document.getElementById('campo-presup-producto-buscar').value = (p.sku ? '[' + p.sku + '] ' : '') + p.nombre;

  var dropdown = document.getElementById('producto-dropdown-presup');
  dropdown.classList.remove('visible');

  document.getElementById('campo-presup-cantidad').focus();
  document.getElementById('campo-presup-cantidad').select();
}

function handleProductoPresupKeydown(e) {
  var dropdown = document.getElementById('producto-dropdown-presup');
  var items = dropdown.querySelectorAll('.producto-dd-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _ddProductoCursor = Math.min(_ddProductoCursor + 1, items.length - 1);
    items.forEach(function(it, i) { it.classList.toggle('activo', i === _ddProductoCursor); });
    if (items[_ddProductoCursor]) items[_ddProductoCursor].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _ddProductoCursor = Math.max(_ddProductoCursor - 1, 0);
    items.forEach(function(it, i) { it.classList.toggle('activo', i === _ddProductoCursor); });
    if (items[_ddProductoCursor]) items[_ddProductoCursor].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_ddProductoCursor >= 0 && items[_ddProductoCursor]) {
      seleccionarProductoPresup(items[_ddProductoCursor].getAttribute('data-id'));
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.remove('visible');
  }
}

// =============================================================================
// Render tabla de líneas del formulario
// =============================================================================

function renderLineasPresup() {
  var wrapper = document.getElementById('lineas-presup-wrapper');

  if (lineasPresupTemp.length === 0) {
    wrapper.innerHTML =
      '<div class="estado-vacio" style="padding:1.5rem 0">' +
      '<span class="estado-vacio-icono">📋</span>' +
      '<p>Agregá productos al presupuesto.</p></div>';
    return;
  }

  var filas = lineasPresupTemp.map(function(l, i) {
    return '<tr>' +
      '<td>' + (l.sku ? '<span class="sku-tag">' + escapar(l.sku) + '</span>' : '') + '</td>' +
      '<td>' + escapar(l.nombre) + '</td>' +
      '<td class="td-num">' +
        '<input type="number" class="cantidad-inline" value="' + l.cantidad + '" min="1" step="1"' +
        ' data-index="' + i + '" style="width:60px; text-align:right;" />' +
      '</td>' +
      '<td class="td-num">ARS ' + formatNum(l.precioUnitario) + '</td>' +
      '<td class="td-num td-costo">ARS ' + formatNum(l.subtotal) + '</td>' +
      '<td class="td-acciones-menu">' +
        '<button type="button" class="btn btn-sm btn-danger" data-eliminar="' + i + '">✕</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  wrapper.innerHTML =
    '<table class="tabla tabla-lineas" style="margin-bottom:0">' +
    '<thead><tr>' +
      '<th>SKU</th><th>Producto</th>' +
      '<th class="td-num">Cant.</th>' +
      '<th class="td-num">P. Unitario</th>' +
      '<th class="td-num">Subtotal</th>' +
      '<th></th>' +
    '</tr></thead>' +
    '<tbody>' + filas + '</tbody>' +
    '</table>';

  // Delegated event listeners
  wrapper.querySelectorAll('.cantidad-inline').forEach(function(input) {
    input.addEventListener('change', function() {
      actualizarCantidadLinea(parseInt(input.dataset.index), input.value);
    });
  });

  wrapper.querySelectorAll('[data-eliminar]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      eliminarLineaPresup(parseInt(btn.dataset.eliminar));
    });
  });
}

// =============================================================================
// Handler: agregar línea
// =============================================================================

function handleAgregarLineaPresup() {
  ocultarErrorLineasPresup();

  var productoId = document.getElementById('campo-presup-producto-id').value;
  var cantidad   = parseFloat(document.getElementById('campo-presup-cantidad').value);

  if (!productoId) { mostrarErrorLineasPresup('Buscá y seleccioná un producto.'); return; }
  if (!cantidad || cantidad < 1) { mostrarErrorLineasPresup('La cantidad debe ser al menos 1.'); return; }

  var precioUnitario;
  try {
    precioUnitario = resolverPrecioUnitario(
      productoId, tipoClienteActual,
      window.AppData.productos, window.AppData.insumos
    );
  } catch (err) { mostrarErrorLineasPresup(err.message); return; }

  var p = window.AppData.productos.find(function(x) { return x.id === productoId; });

  var existente = lineasPresupTemp.find(function(l) { return l.productoId === productoId; });
  if (existente) {
    existente.cantidad += cantidad;
    existente.subtotal  = existente.cantidad * existente.precioUnitario;
  } else {
    lineasPresupTemp.push({
      productoId:     productoId,
      sku:            p ? p.sku || '' : '',
      nombre:         p ? p.nombre || '(desconocido)' : '(desconocido)',
      cantidad:       cantidad,
      precioUnitario: precioUnitario,
      subtotal:       cantidad * precioUnitario
    });
  }

  document.getElementById('campo-presup-producto-buscar').value = '';
  document.getElementById('campo-presup-producto-id').value = '';
  document.getElementById('campo-presup-cantidad').value = '1';
  _productoPresupSeleccionado = null;
  renderLineasPresup();
  recalcularTotales();
  document.getElementById('campo-presup-producto-buscar').focus();
}

function actualizarCantidadLinea(index, nuevaCantidad) {
  var cant = parseFloat(nuevaCantidad);
  if (!cant || cant < 1) return;
  lineasPresupTemp[index].cantidad = cant;
  lineasPresupTemp[index].subtotal = cant * lineasPresupTemp[index].precioUnitario;
  renderLineasPresup();
  recalcularTotales();
}

function eliminarLineaPresup(index) {
  lineasPresupTemp.splice(index, 1);
  renderLineasPresup();
  recalcularTotales();
}

// =============================================================================
// Totales en vivo
// =============================================================================

function _simbol() {
  return monedaActual === 'USD' ? 'USD ' : 'ARS ';
}

function _convertirPrecio(precioARS) {
  if (monedaActual === 'USD' && tipoCambioActual > 0) return precioARS / tipoCambioActual;
  return precioARS;
}

function recalcularTotales() {
  var descuento  = parseFloat(document.getElementById('campo-descuento').value) || 0;
  var costoEnvio = parseFloat(document.getElementById('campo-envio').value)     || 0;
  var clienteNombre = _clienteSeleccionado
    ? _clienteSeleccionado.nombre
    : document.getElementById('campo-cliente-texto').value.trim();
  var validez = parseInt(document.getElementById('campo-validez').value) || 0;

  // Las líneas ya tienen precioUnitario en ARS; convertir para mostrar
  var lineasConvertidas = lineasPresupTemp.map(function(l) {
    return {
      cantidad:       l.cantidad,
      precioUnitario: _convertirPrecio(l.precioUnitario),
      subtotal:       _convertirPrecio(l.subtotal)
    };
  });
  var costoEnvioConvertido = _convertirPrecio(costoEnvio);

  var t = calcularTotalesPresupuesto(lineasConvertidas, descuento, costoEnvioConvertido);
  var s = _simbol();

  document.getElementById('tot-subtotal').textContent = s + formatNum(t.subtotalLineas);
  document.getElementById('tot-envio').textContent    = s + formatNum(costoEnvioConvertido);
  document.getElementById('tot-total').textContent    = s + formatNum(t.total);

  var filaDesc = document.getElementById('fila-descuento');
  if (descuento > 0) {
    filaDesc.classList.remove('oculto');
    document.getElementById('lbl-descuento').textContent = 'Descuento (' + descuento + '%)';
    document.getElementById('tot-descuento').textContent = '— ' + s + formatNum(t.montoDescuento);
  } else {
    filaDesc.classList.add('oculto');
  }

  document.getElementById('totales-cliente').textContent =
    clienteNombre ? 'Para: ' + clienteNombre : 'Sin cliente seleccionado';

  if (validez > 0) {
    var vence = new Date();
    vence.setDate(vence.getDate() + validez);
    document.getElementById('totales-validez').textContent =
      'Vence: ' + vence.toLocaleDateString('es-AR') + ' (' + validez + ' días)';
  } else {
    document.getElementById('totales-validez').textContent = '';
  }
}

// =============================================================================
// Guardar presupuesto
// =============================================================================

function guardarPresupuesto() {
  ocultarErrorPresup();

  var clienteNombre = _clienteSeleccionado
    ? _clienteSeleccionado.nombre
    : document.getElementById('campo-cliente-texto').value.trim();

  var campos = {
    cliente:     clienteNombre,
    validezDias: document.getElementById('campo-validez').value,
    tipoCliente: tipoClienteActual,
    moneda:      monedaActual,
    tipoDolar:   monedaActual === 'USD' ? tipoDolarActual : null,
    tipoCambio:  monedaActual === 'USD' ? tipoCambioActual : 0,
    descuento:   document.getElementById('campo-descuento').value,
    costoEnvio:  document.getElementById('campo-envio').value,
    lineasBase:  lineasPresupTemp.map(function(l) {
      return { productoId: l.productoId, cantidad: l.cantidad };
    })
  };

  try {
    var presupuesto = crearPresupuesto(
      campos, window.AppData.productos, window.AppData.insumos
    );
    agregarPresupuesto(presupuesto);
    renderPresupuestosList();
    limpiarFormPresupuesto();
  } catch (err) {
    mostrarErrorPresup(err.message);
  }
}

function cancelarPresupuesto() { limpiarFormPresupuesto(); }

function limpiarFormPresupuesto() {
  document.getElementById('campo-cliente-texto').value = '';
  document.getElementById('campo-cliente-id').value    = '';
  document.getElementById('campo-cliente-nombre').value = '';
  document.getElementById('cliente-info-card').classList.add('oculto');
  document.getElementById('campo-validez').value   = '15';
  document.getElementById('campo-envio').value     = '0';
  document.getElementById('campo-descuento').value = '0';
  lineasPresupTemp  = [];
  tipoClienteActual = 'consumidor';
  monedaActual      = 'ARS';
  tipoDolarActual   = 'blue';
  tipoCambioActual  = 0;
  _clienteSeleccionado = null;
  setTipoCliente('consumidor');
  setMoneda('ARS');
  renderLineasPresup();
  recalcularTotales();
  document.getElementById('btn-cancelar-presup').classList.add('oculto');
  document.getElementById('form-presup-titulo').textContent = 'Nuevo presupuesto';
  ocultarErrorPresup();
  ocultarErrorLineasPresup();
}

// =============================================================================
// Render historial de presupuestos — con menú (···) de acciones
// =============================================================================

function renderPresupuestosList() {
  var presupuestos = getPresupuestos();
  var wrapper      = document.getElementById('tabla-presupuestos-wrapper');
  var contador     = document.getElementById('contador-presupuestos');

  contador.textContent = presupuestos.length +
    (presupuestos.length === 1 ? ' presupuesto' : ' presupuestos');

  if (presupuestos.length === 0) {
    wrapper.innerHTML =
      '<div class="estado-vacio">' +
      '<span class="estado-vacio-icono">📄</span>' +
      '<p>No hay presupuestos guardados todavía.</p></div>';
    return;
  }

  var ordenados = presupuestos.slice().reverse();

  var filas = ordenados.map(function(p) {
    var fecha  = new Date(p.fecha).toLocaleDateString('es-AR');
    var vence  = new Date(p.fechaVencimiento).toLocaleDateString('es-AR');
    var vencido = new Date(p.fechaVencimiento) < new Date();
    var tipo   = p.tipoCliente === 'distribuidor' ? 'Dist.' : 'Cons.';
    var items  = p.lineas.length;

    return '<tr>' +
      '<td class="presup-num">N° ' + String(p.numero).padStart(4,'0') + '</td>' +
      '<td>' + escapar(p.cliente) + '</td>' +
      '<td class="td-num">' + fecha + '</td>' +
      '<td class="td-num" style="color:' + (vencido ? 'var(--error)' : 'var(--text-2)') + '">' +
        vence + (vencido ? ' ⚠' : '') + '</td>' +
      '<td>' + tipo + '</td>' +
      '<td class="td-num">' + items + ' ítem' + (items !== 1 ? 's' : '') + '</td>' +
      '<td class="td-num td-costo">' + (p.moneda === 'USD' ? 'USD ' : 'ARS ') + formatNum(p.total) + '</td>' +
      '<td class="td-acciones-menu">' +
        '<div class="menu-acciones-presup">' +
          '<button type="button" class="btn-menu-presup" data-menu-id="' + p.id + '">⋯</button>' +
          '<div class="menu-dropdown-presup" id="menu-' + p.id + '">' +
            '<button data-accion="detalles" data-id="' + p.id + '">📋 Detalles</button>' +
            '<button data-accion="excel" data-id="' + p.id + '">📊 Descargar Excel</button>' +
            '<button data-accion="pdf" data-id="' + p.id + '">📄 Descargar PDF</button>' +
            '<button data-accion="confirmar" data-id="' + p.id + '" data-numero="' + p.numero + '">✅ Confirmar presupuesto</button>' +
            '<button data-accion="eliminar" data-id="' + p.id + '" data-numero="' + p.numero + '" class="menu-item-danger">🗑 Eliminar</button>' +
          '</div>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');

  wrapper.innerHTML =
    '<table class="tabla tabla-presupuestos">' +
    '<thead><tr>' +
      '<th>N°</th><th>Cliente</th>' +
      '<th class="td-num">Fecha</th><th class="td-num">Vence</th>' +
      '<th>Tipo</th><th class="td-num">Ítems</th>' +
      '<th class="td-num">Total</th><th>Acciones</th>' +
    '</tr></thead>' +
    '<tbody>' + filas + '</tbody>' +
    '</table>';

  // Bind events del menú
  _bindMenusPresupuestos();
}

function _bindMenusPresupuestos() {
  // Toggle menú
  document.querySelectorAll('.btn-menu-presup').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var menuId = 'menu-' + btn.dataset.menuId;
      var menu = document.getElementById(menuId);
      var estaAbierto = menu.classList.contains('visible');

      _cerrarTodosMenusPresup();

      if (!estaAbierto) {
        menu.classList.add('visible');
        _menuPresupAbierto = menu;
      }
    });
  });

  // Acciones del menú
  document.querySelectorAll('.menu-dropdown-presup button').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var accion = btn.dataset.accion;
      var id     = btn.dataset.id;
      _cerrarTodosMenusPresup();

      switch (accion) {
        case 'detalles':
          mostrarDetallePresupuesto(id);
          break;
        case 'excel':
          _exportarPresupExcel(id);
          break;
        case 'pdf':
          _exportarPresupPDF(id);
          break;
        case 'confirmar':
          confirmarPresupuestoComoOrden(id);
          break;
        case 'eliminar':
          confirmarEliminarPresupuesto(id, parseInt(btn.dataset.numero));
          break;
      }
    });
  });
}

function _cerrarTodosMenusPresup() {
  document.querySelectorAll('.menu-dropdown-presup.visible').forEach(function(m) {
    m.classList.remove('visible');
  });
  _menuPresupAbierto = null;
}

function confirmarEliminarPresupuesto(id, numero) {
  if (!confirm('¿Eliminar el presupuesto N° ' + String(numero).padStart(4,'0') + '?')) return;
  eliminarPresupuesto(id);
  renderPresupuestosList();
}

// =============================================================================
// Modal de detalles del presupuesto
// =============================================================================

function mostrarDetallePresupuesto(id) {
  var p = getPresupuestoPorId(id);
  if (!p) return;

  var fecha  = new Date(p.fecha).toLocaleDateString('es-AR');
  var vence  = new Date(p.fechaVencimiento).toLocaleDateString('es-AR');
  var vencido = new Date(p.fechaVencimiento) < new Date();
  var tipo   = p.tipoCliente === 'distribuidor' ? 'Distribuidor' : 'Consumidor final';

  document.getElementById('modal-presup-titulo').textContent =
    'Presupuesto N° ' + String(p.numero).padStart(4,'0');

  var html = '';

  // Datos generales
  html += '<div class="detalle-seccion">';
  html += '<h4>Información general</h4>';
  html += '<div class="detalle-grid">';
  html += _campoDetalle('Cliente', escapar(p.cliente));
  html += _campoDetalle('Tipo de precio', tipo);
  html += _campoDetalle('Fecha de emisión', fecha);
  html += _campoDetalle('Válido hasta', vence + (vencido ? ' <span style="color:var(--error)">⚠ Vencido</span>' : ''));
  html += _campoDetalle('Validez', p.validezDias + ' días');
  html += _campoDetalle('Moneda', p.moneda === 'USD'
    ? 'USD — Dólar ' + (p.tipoDolar === 'oficial' ? 'Oficial' : p.tipoDolar === 'divisa' ? 'Mayorista' : 'Blue') +
      ' — 1 USD = ARS ' + formatNum(p.tipoCambio)
    : 'ARS');
  html += _campoDetalle('Descuento', p.descuento + '%');
  var simM = p.moneda === 'USD' ? 'USD ' : 'ARS ';
  html += _campoDetalle('Costo de envío', simM + formatNum(p.costoEnvio));
  html += '</div></div>';

  // Tabla de productos
  html += '<div class="detalle-seccion">';
  html += '<h4>Productos</h4>';
  html += '<table class="detalle-tabla-lineas"><thead><tr>';
  html += '<th>SKU</th><th>Producto</th><th class="td-num">Cant.</th>';
  html += '<th class="td-num">P. Unit.</th><th class="td-num">Subtotal</th>';
  html += '</tr></thead><tbody>';

  (p.lineas || []).forEach(function(l) {
    html += '<tr>';
    html += '<td>' + (l.sku && l.sku !== '—' ? '<span class="sku-tag">' + escapar(l.sku) + '</span>' : '—') + '</td>';
    html += '<td>' + escapar(l.nombre) + '</td>';
    html += '<td class="td-num">' + l.cantidad + '</td>';
    html += '<td class="td-num">' + simM + formatNum(l.precioUnitario) + '</td>';
    html += '<td class="td-num td-costo">' + simM + formatNum(l.subtotal) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // Totales
  html += '<div class="detalle-seccion">';
  html += '<h4>Totales</h4>';
  html += '<div class="detalle-totales">';
  html += '<div class="totales-fila"><span class="tl">Subtotal</span><span class="tv">' + simM + formatNum(p.subtotalLineas) + '</span></div>';

  if (p.descuento > 0) {
    html += '<div class="totales-fila descuento-fila"><span class="tl">Descuento (' + p.descuento + '%)</span><span class="tv">— ' + simM + formatNum(p.montoDescuento) + '</span></div>';
  }

  html += '<div class="totales-fila"><span class="tl">Costo de envío</span><span class="tv">' + simM + formatNum(p.costoEnvio) + '</span></div>';
  html += '<div class="totales-fila total-final"><span class="tl">TOTAL</span><span class="tv">' + simM + formatNum(p.total) + '</span></div>';
  html += '</div></div>';

  document.getElementById('modal-presup-contenido').innerHTML = html;

  var modal = document.getElementById('modal-detalle-presup');
  modal.classList.remove('modal-oculto');
}

function _campoDetalle(label, valor) {
  return '<div class="detalle-campo">' +
    '<span class="detalle-label">' + label + '</span>' +
    '<span class="detalle-valor">' + valor + '</span>' +
    '</div>';
}

function cerrarModalDetallePresup() {
  document.getElementById('modal-detalle-presup').classList.add('modal-oculto');
}

// =============================================================================
// Confirmar presupuesto → crear orden de producción
// =============================================================================

function confirmarPresupuestoComoOrden(id) {
  var p = getPresupuestoPorId(id);
  if (!p) { alert('Presupuesto no encontrado.'); return; }

  var numPresup = String(p.numero).padStart(4, '0');

  if (!confirm('¿Confirmar el presupuesto N° ' + numPresup + ' y crear una orden de producción?')) return;

  // Verificar que las funciones de producción estén disponibles
  if (typeof crearOrden !== 'function' || typeof agregarOrden !== 'function') {
    alert('Error: el módulo de producción no está cargado.');
    return;
  }

  // Mapear líneas del presupuesto al formato de producción
  var lineasOrden = (p.lineas || []).map(function(l) {
    return {
      productoId: l.productoId,
      cantidad:   l.cantidad
    };
  });

  try {
    var orden = crearOrden({
      lineas:        lineasOrden,
      cliente:       p.cliente || '',
      numeroExterno: numPresup,
      canal:         '',
      metodoPago:    '',
      notas:         'Orden creada desde el módulo presupuestos',
      espontanea:    false
    });

    agregarOrden(orden);

    var numOrden = String(orden.numero).padStart(4, '0');
    alert('Orden de producción N° ' + numOrden + ' creada exitosamente a partir del presupuesto N° ' + numPresup + '.');

  } catch (err) {
    alert('Error al crear la orden: ' + err.message);
  }
}

// =============================================================================
// Exportar presupuesto a Excel (corregido con datos completos)
// =============================================================================

function _exportarPresupExcel(id) {
  var p = getPresupuestoPorId(id);
  if (!p) { alert('Presupuesto no encontrado.'); return; }

  if (typeof XLSX === 'undefined') {
    alert('No se puede generar Excel. Falta la biblioteca SheetJS.');
    return;
  }

  var fecha  = new Date(p.fecha).toLocaleDateString('es-AR');
  var vence  = new Date(p.fechaVencimiento).toLocaleDateString('es-AR');
  var tipo   = p.tipoCliente === 'distribuidor' ? 'Distribuidor' : 'Consumidor final';
  var simX   = p.moneda === 'USD' ? 'USD' : 'ARS';
  var monedaLabel = p.moneda === 'USD'
    ? 'USD — Dólar ' + (p.tipoDolar === 'oficial' ? 'Oficial' : p.tipoDolar === 'divisa' ? 'Mayorista' : 'Blue') + ' (1 USD = ARS ' + formatNum(p.tipoCambio) + ')'
    : 'ARS';

  var data = [];

  // Título
  data.push(['PRESUPUESTO N° ' + String(p.numero).padStart(4,'0')]);
  data.push([]);

  // Información completa
  data.push(['Fecha:', fecha]);
  data.push(['Válido hasta:', vence]);
  data.push(['Cliente:', p.cliente || '—']);
  data.push(['Tipo:', tipo]);
  data.push(['Moneda:', monedaLabel]);
  data.push(['Descuento:', p.descuento + '%']);
  data.push(['Costo de envío (' + simX + '):', p.costoEnvio]);
  data.push([]);

  // Encabezados de productos
  data.push(['SKU', 'Producto', 'Cantidad', 'P. Unitario (' + simX + ')', 'Subtotal (' + simX + ')']);

  // Líneas de productos
  (p.lineas || []).forEach(function(linea) {
    data.push([
      linea.sku || '—',
      linea.nombre,
      linea.cantidad,
      linea.precioUnitario,
      linea.subtotal
    ]);
  });

  // Totales
  data.push([]);
  data.push(['', '', '', 'Subtotal:', p.subtotalLineas || 0]);
  if (p.descuento > 0) {
    data.push(['', '', '', 'Descuento (' + p.descuento + '%):', -(p.montoDescuento || 0)]);
  }
  data.push(['', '', '', 'Costo de envío:', p.costoEnvio || 0]);
  data.push(['', '', '', 'TOTAL ' + simX + ':', p.total || 0]);

  // Crear Excel
  var ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 }
  ];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');

  var fname = 'presupuesto_' + String(p.numero).padStart(4, '0') + '_' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}

// =============================================================================
// Exportar presupuesto a PDF (via window.print con contenido formateado)
// =============================================================================

function _exportarPresupPDF(id) {
  var p = getPresupuestoPorId(id);
  if (!p) { alert('Presupuesto no encontrado.'); return; }

  var fecha  = new Date(p.fecha).toLocaleDateString('es-AR');
  var vence  = new Date(p.fechaVencimiento).toLocaleDateString('es-AR');
  var tipo   = p.tipoCliente === 'distribuidor' ? 'Distribuidor' : 'Consumidor final';
  var simP   = p.moneda === 'USD' ? 'USD ' : 'ARS ';
  var monedaInfoPDF = p.moneda === 'USD'
    ? 'USD — Dólar ' + (p.tipoDolar === 'oficial' ? 'Oficial' : p.tipoDolar === 'divisa' ? 'Mayorista' : 'Blue') + ' (1 USD = ARS ' + formatNum(p.tipoCambio) + ')'
    : 'ARS';

  var lineasHTML = (p.lineas || []).map(function(l) {
    return '<tr>' +
      '<td>' + escapar(l.sku || '—') + '</td>' +
      '<td>' + escapar(l.nombre) + '</td>' +
      '<td style="text-align:right">' + l.cantidad + '</td>' +
      '<td style="text-align:right">' + simP + formatNum(l.precioUnitario) + '</td>' +
      '<td style="text-align:right">' + simP + formatNum(l.subtotal) + '</td>' +
    '</tr>';
  }).join('');

  var descuentoHTML = '';
  if (p.descuento > 0) {
    descuentoHTML =
      '<tr>' +
        '<td colspan="4" style="text-align:right;padding:4px 8px;">Descuento (' + p.descuento + '%)</td>' +
        '<td style="text-align:right;padding:4px 8px;color:#c00;">— ' + simP + formatNum(p.montoDescuento) + '</td>' +
      '</tr>';
  }

  var contenido = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Presupuesto N° ' + String(p.numero).padStart(4,'0') + '</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;color:#222;margin:2rem;font-size:13px;}' +
      'h1{font-size:1.4rem;margin-bottom:0.25rem;}' +
      '.info{margin:1rem 0;line-height:1.8;}' +
      '.info strong{display:inline-block;width:140px;}' +
      'table{width:100%;border-collapse:collapse;margin:1rem 0;}' +
      'th{background:#f5f5f5;text-align:left;padding:6px 8px;border-bottom:2px solid #999;font-size:0.8rem;}' +
      'td{padding:5px 8px;border-bottom:1px solid #ddd;}' +
      '.totales td{border-bottom:none;font-weight:500;}' +
      '.total-final td{font-size:1.1rem;font-weight:700;border-top:2px solid #333;}' +
      '.footer{margin-top:2rem;font-size:0.75rem;color:#777;border-top:1px solid #ccc;padding-top:0.5rem;}' +
    '</style></head><body>' +
    '<h1>PRESUPUESTO N° ' + String(p.numero).padStart(4,'0') + '</h1>' +
    '<div class="info">' +
      '<strong>Cliente:</strong> ' + escapar(p.cliente) + '<br>' +
      '<strong>Tipo:</strong> ' + tipo + '<br>' +
      '<strong>Moneda:</strong> ' + monedaInfoPDF + '<br>' +
      '<strong>Fecha:</strong> ' + fecha + '<br>' +
      '<strong>Válido hasta:</strong> ' + vence + '<br>' +
      '<strong>Descuento:</strong> ' + p.descuento + '%<br>' +
      '<strong>Costo de envío:</strong> ' + simP + formatNum(p.costoEnvio) + '<br>' +
    '</div>' +
    '<table>' +
      '<thead><tr><th>SKU</th><th>Producto</th><th style="text-align:right">Cant.</th>' +
      '<th style="text-align:right">P. Unitario</th><th style="text-align:right">Subtotal</th></tr></thead>' +
      '<tbody>' + lineasHTML + '</tbody>' +
      '<tfoot class="totales">' +
        '<tr><td colspan="5"></td></tr>' +
        '<tr><td colspan="4" style="text-align:right;padding:4px 8px;">Subtotal</td>' +
          '<td style="text-align:right;padding:4px 8px;">' + simP + formatNum(p.subtotalLineas) + '</td></tr>' +
        descuentoHTML +
        '<tr><td colspan="4" style="text-align:right;padding:4px 8px;">Costo de envío</td>' +
          '<td style="text-align:right;padding:4px 8px;">' + simP + formatNum(p.costoEnvio) + '</td></tr>' +
        '<tr class="total-final"><td colspan="4" style="text-align:right;padding:4px 8px;">TOTAL</td>' +
          '<td style="text-align:right;padding:4px 8px;">' + simP + formatNum(p.total) + '</td></tr>' +
      '</tfoot>' +
    '</table>' +
    '<div class="footer">Presupuesto generado por CostosApp — Dismascapacidad</div>' +
    '</body></html>';

  // Abrir ventana de impresión
  var ventana = window.open('', '_blank', 'width=800,height=600');
  ventana.document.write(contenido);
  ventana.document.close();
  ventana.focus();
  setTimeout(function() {
    ventana.print();
  }, 400);
}

// =============================================================================
// Importar / Exportar datos (sidebar)
// =============================================================================

function handleImport(event) {
  var file = event.target.files[0];
  if (!file) return;
  importData(file).then(function() {
    alert('Importado correctamente.');
    location.reload();
  }).catch(function(err) {
    alert('Error: ' + err.message);
  });
}

// =============================================================================
// Bind de eventos y arranque
// =============================================================================

function bindFormPresupuesto() {
  // Inputs del encabezado que actualizan totales
  document.getElementById('campo-validez').addEventListener('input', recalcularTotales);
  document.getElementById('campo-envio').addEventListener('input', recalcularTotales);
  document.getElementById('campo-descuento').addEventListener('input', recalcularTotales);

  // Cliente
  var campoCliente = document.getElementById('campo-cliente-texto');
  campoCliente.addEventListener('input', function() {
    filtrarDropdownClientes(this.value);
  });
  campoCliente.addEventListener('focus', function() {
    filtrarDropdownClientes(this.value);
  });
  campoCliente.addEventListener('blur', cerrarDropdownClientes);
  campoCliente.addEventListener('keydown', handleClienteKeydown);

  document.getElementById('btn-cambiar-cliente').addEventListener('click', limpiarClienteSeleccionado);

  // Tipo de cliente
  document.getElementById('btn-tipo-consumidor').addEventListener('click', function() {
    setTipoCliente('consumidor');
  });
  document.getElementById('btn-tipo-distribuidor').addEventListener('click', function() {
    setTipoCliente('distribuidor');
  });

  // Moneda
  document.getElementById('btn-moneda-ars').addEventListener('click', function() { setMoneda('ARS'); });
  document.getElementById('btn-moneda-usd').addEventListener('click', function() { setMoneda('USD'); });
  document.getElementById('campo-tipo-dolar').addEventListener('change', actualizarCotizacionSeleccionada);

  // Buscador de productos
  var campoProd = document.getElementById('campo-presup-producto-buscar');
  campoProd.addEventListener('input', function() {
    filtrarProductosPresup(this.value);
  });
  campoProd.addEventListener('focus', function() {
    filtrarProductosPresup(this.value);
  });
  campoProd.addEventListener('keydown', handleProductoPresupKeydown);

  // Botón agregar línea
  document.getElementById('btn-agregar-linea').addEventListener('click', handleAgregarLineaPresup);

  // Enter en campo cantidad = agregar
  document.getElementById('campo-presup-cantidad').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAgregarLineaPresup();
    }
  });

  // Guardar / Cancelar
  document.getElementById('btn-guardar-presup').addEventListener('click', guardarPresupuesto);
  document.getElementById('btn-cancelar-presup').addEventListener('click', cancelarPresupuesto);

  // Modal detalle — cerrar
  document.getElementById('btn-cerrar-modal-presup').addEventListener('click', cerrarModalDetallePresup);
  document.getElementById('modal-detalle-presup').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalDetallePresup();
  });

  // Sidebar: exportar / importar
  document.getElementById('btn-exportar-datos').addEventListener('click', function() {
    if (typeof exportData === 'function') exportData();
  });
  document.getElementById('input-importar-datos').addEventListener('change', handleImport);

  // Cerrar dropdown de productos y menús al clic fuera
  document.addEventListener('click', function(e) {
    // Dropdown de productos
    var wrap = document.querySelector('.producto-search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('producto-dropdown-presup').classList.remove('visible');
    }

    // Menús de acciones del historial
    if (!e.target.closest('.menu-acciones-presup')) {
      _cerrarTodosMenusPresup();
    }
  });

  // Escape cierra modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('modal-detalle-presup');
      if (!modal.classList.contains('modal-oculto')) cerrarModalDetallePresup();
      _cerrarTodosMenusPresup();
    }
  });
}

function initPresupuestosUI() {
  poblarDropdownClientesData();
  renderLineasPresup();
  recalcularTotales();
  renderPresupuestosList();
  bindFormPresupuesto();
  console.log('[presupuestos-ui] Módulo UI inicializado.');
}

// =============================================================================
// Arranque
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
  // Widget dólar
  var cache = getCacheDolar();
  renderDolarWidget(cache);
  fetchDolarBlue().then(renderDolarWidget);

  // Esperar a que app.js cargue los datos
  // (app.js invoca initPresupuestos que es la lógica de negocio)
  // Luego inicializar la UI
  setTimeout(function() {
    initPresupuestosUI();
  }, 50);
});
