/**
 * crm.js
 * Lógica de negocio pura del módulo CRM.
 * Sin referencias al DOM, Supabase ni AppData.
 */

// ── Constantes y etiquetas ────────────────────────────────────────────────────

var CRM_ESTADOS_ACTIVOS = ['nuevo', 'en_conversacion', 'propuesta_enviada'];

var CRM_ESTADO_LABELS = {
  nuevo:             'Nuevo',
  en_conversacion:   'En conversación',
  propuesta_enviada: 'Propuesta enviada',
  convertido:        'Convertido',
  sin_respuesta:     'Sin respuesta'
};

var CRM_TIPO_LABELS = {
  profesional: 'Profesional',
  institucion: 'Institución',
  aliado:      'Aliado / Revendedor',
  familia:     'Familia / Usuario'
};

var CRM_ORIGEN_LABELS = {
  landing_epe: 'Landing EpE',
  tienda:      'Tienda',
  referido:    'Referido',
  red_social:  'Red social',
  otro:        'Otro'
};

var CRM_CANAL_LABELS = {
  whatsapp:   'WhatsApp',
  email:      'Email',
  telefono:   'Teléfono',
  presencial: 'Presencial',
  otro:       'Otro'
};

// ── Filtros del dashboard ─────────────────────────────────────────────────────

/**
 * Casos activos con fecha_proxima_accion estrictamente anterior a hoy.
 * @param {Array} casos
 * @returns {Array}
 */
function crm_getSeguimientosVencidos(casos) {
  var hoy = _crm_hoyStr();
  return casos.filter(function(c) {
    return CRM_ESTADOS_ACTIVOS.indexOf(c.estado) !== -1 &&
           c.fecha_proxima_accion &&
           c.fecha_proxima_accion < hoy;
  }).sort(function(a, b) {
    return a.fecha_proxima_accion < b.fecha_proxima_accion ? -1 : 1;
  });
}

/**
 * Casos activos con fecha_proxima_accion igual a hoy.
 * @param {Array} casos
 * @returns {Array}
 */
function crm_getSeguimientosHoy(casos) {
  var hoy = _crm_hoyStr();
  return casos.filter(function(c) {
    return CRM_ESTADOS_ACTIVOS.indexOf(c.estado) !== -1 &&
           c.fecha_proxima_accion === hoy;
  });
}

/**
 * Casos activos con fecha_proxima_accion entre mañana y los próximos N días.
 * @param {Array}  casos
 * @param {number} [dias=15]
 * @returns {Array}
 */
function crm_getSeguimientosProximos(casos, dias) {
  dias = dias || 15;
  var hoy = _crm_hoyStr();

  var d = new Date();
  d.setDate(d.getDate() + dias);
  var mes    = String(d.getMonth() + 1).padStart(2, '0');
  var dia    = String(d.getDate()).padStart(2, '0');
  var limite = d.getFullYear() + '-' + mes + '-' + dia;

  return casos.filter(function(c) {
    return CRM_ESTADOS_ACTIVOS.indexOf(c.estado) !== -1 &&
           c.fecha_proxima_accion &&
           c.fecha_proxima_accion > hoy &&
           c.fecha_proxima_accion <= limite;
  }).sort(function(a, b) {
    return a.fecha_proxima_accion < b.fecha_proxima_accion ? -1 : 1;
  });
}

/**
 * Casos activos sin interacciones en los últimos N días
 * (excluyendo los que ya aparecen en vencidos o hoy).
 * @param {Array}  casos
 * @param {Array}  interacciones
 * @param {number} [dias=7]
 * @returns {Array}
 */
function crm_getCasosInactivos(casos, interacciones, dias) {
  dias = dias || 7;
  var umbral = new Date();
  umbral.setDate(umbral.getDate() - dias);
  var hoy = _crm_hoyStr();

  return casos.filter(function(c) {
    if (CRM_ESTADOS_ACTIVOS.indexOf(c.estado) === -1) return false;

    // Excluir los que ya tienen seguimiento vencido o de hoy
    if (c.fecha_proxima_accion && c.fecha_proxima_accion <= hoy) return false;

    var delCaso = interacciones.filter(function(i) { return i.caso_id === c.id; });

    if (delCaso.length === 0) {
      // Sin interacciones: usar fecha_ultima_actividad del caso
      return new Date(c.fecha_ultima_actividad) < umbral;
    }

    var masReciente = delCaso.reduce(function(max, i) {
      return new Date(i.fecha) > new Date(max.fecha) ? i : max;
    }, delCaso[0]);

    return new Date(masReciente.fecha) < umbral;
  }).sort(function(a, b) {
    return new Date(a.fecha_ultima_actividad) - new Date(b.fecha_ultima_actividad);
  });
}

// ── Filtros de lista de contactos ─────────────────────────────────────────────

/**
 * Filtra contactos según tipo, estado del caso activo y texto.
 * @param {Array}  contactos
 * @param {Array}  casos
 * @param {Object} filtros  { tipo, estadoCaso, texto }
 * @returns {Array}
 */
function crm_filtrarContactos(contactos, casos, filtros) {
  var texto     = ((filtros && filtros.texto)     || '').toLowerCase().trim();
  var tipo      = (filtros && filtros.tipo)      || 'todos';
  var estadoCaso = (filtros && filtros.estadoCaso) || 'todos';

  return contactos.filter(function(contacto) {
    if (tipo !== 'todos' && contacto.tipo !== tipo) return false;

    if (texto && !(
      contacto.nombre.toLowerCase().indexOf(texto) !== -1 ||
      (contacto.telefono || '').toLowerCase().indexOf(texto) !== -1 ||
      (contacto.email    || '').toLowerCase().indexOf(texto) !== -1
    )) return false;

    if (estadoCaso !== 'todos') {
      var casosDelContacto = casos.filter(function(c) { return c.contacto_id === contacto.id; });
      var tieneEstado = casosDelContacto.some(function(c) { return c.estado === estadoCaso; });
      if (!tieneEstado) return false;
    }

    return true;
  });
}

/**
 * Devuelve el caso más relevante de un contacto para mostrar en la lista.
 * Prioriza: activos > por última actividad.
 * @param {string} contactoId
 * @param {Array}  casos
 * @returns {Object|null}
 */
function crm_getCasoRelevante(contactoId, casos) {
  var delContacto = casos.filter(function(c) { return c.contacto_id === contactoId; });
  if (delContacto.length === 0) return null;

  var activos = delContacto.filter(function(c) {
    return CRM_ESTADOS_ACTIVOS.indexOf(c.estado) !== -1;
  });

  var pool = activos.length > 0 ? activos : delContacto;
  return pool.sort(function(a, b) {
    return new Date(b.fecha_ultima_actividad) - new Date(a.fecha_ultima_actividad);
  })[0];
}

/**
 * Cuenta cuántos casos activos tiene un contacto.
 * @param {string} contactoId
 * @param {Array}  casos
 * @returns {number}
 */
function crm_countCasosActivos(contactoId, casos) {
  return casos.filter(function(c) {
    return c.contacto_id === contactoId &&
           CRM_ESTADOS_ACTIVOS.indexOf(c.estado) !== -1;
  }).length;
}

// ── Formateo de fechas ────────────────────────────────────────────────────────

/**
 * Fecha de hoy en formato YYYY-MM-DD (en zona horaria local).
 * @returns {string}
 */
function _crm_hoyStr() {
  var d = new Date();
  var mes = String(d.getMonth() + 1).padStart(2, '0');
  var dia = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mes + '-' + dia;
}

/**
 * Formatea una fecha ISO o DATE a DD/MM/YYYY.
 * @param {string} isoStr
 * @returns {string}
 */
function crm_formatFecha(isoStr) {
  if (!isoStr) return '—';
  var d = new Date(isoStr.length === 10 ? isoStr + 'T12:00:00' : isoStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Texto relativo de antigüedad ("Hoy", "Ayer", "Hace 3 días"…).
 * @param {string} isoStr
 * @returns {string}
 */
function crm_formatAntiguedad(isoStr) {
  if (!isoStr) return '—';
  var ahora = new Date();
  var fecha = new Date(isoStr.length === 10 ? isoStr + 'T12:00:00' : isoStr);
  var dias = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
  if (dias === 0)  return 'Hoy';
  if (dias === 1)  return 'Ayer';
  if (dias < 7)   return 'Hace ' + dias + ' días';
  if (dias < 30)  return 'Hace ' + Math.floor(dias / 7) + ' sem.';
  var meses = Math.floor(dias / 30);
  return 'Hace ' + meses + (meses === 1 ? ' mes' : ' meses');
}

/**
 * Cuántos días de retraso tiene una fecha (positivo = atrasado).
 * @param {string} fechaStr YYYY-MM-DD
 * @returns {number}
 */
function crm_diasRetraso(fechaStr) {
  if (!fechaStr) return 0;
  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  var fecha = new Date(fechaStr + 'T00:00:00');
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
}

// ── Helpers de UI compartidos ─────────────────────────────────────────────────

/**
 * Escapa HTML para inserción segura en innerHTML.
 * @param {*} str
 * @returns {string}
 */
function crm_esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Badge HTML para el estado de un caso.
 * @param {string} estado
 * @returns {string}
 */
function crm_badgeEstado(estado) {
  var label = CRM_ESTADO_LABELS[estado] || estado;
  return '<span class="crm-badge crm-badge-estado crm-estado-' + crm_esc(estado) + '">' + crm_esc(label) + '</span>';
}

/**
 * Badge HTML para el tipo de contacto.
 * @param {string} tipo
 * @returns {string}
 */
function crm_badgeTipo(tipo) {
  var label = CRM_TIPO_LABELS[tipo] || tipo;
  return '<span class="crm-badge crm-badge-tipo crm-tipo-' + crm_esc(tipo) + '">' + crm_esc(label) + '</span>';
}

/**
 * Badge HTML para el canal de una interacción.
 * @param {string} canal
 * @returns {string}
 */
function crm_badgeCanal(canal) {
  var label = CRM_CANAL_LABELS[canal] || canal;
  return '<span class="crm-badge crm-badge-canal">' + crm_esc(label) + '</span>';
}

/**
 * Pobla un <select> con los productos de AppData.productos.
 * Agrega "Otro (texto libre)" al final.
 * @param {HTMLSelectElement} selectEl
 * @param {string}            [valorActual]  valor a pre-seleccionar
 */
function crm_poblarSelectProductos(selectEl, valorActual) {
  var productos = (window.AppData && window.AppData.productos) || [];

  var html = '<option value="">— Seleccionar —</option>';

  if (productos.length > 0) {
    html += '<optgroup label="Productos del catálogo">';
    productos.forEach(function(p) {
      var label = p.sku ? p.sku + ' — ' + p.nombre : p.nombre;
      var val   = crm_esc(p.nombre);
      html += '<option value="' + val + '">' + crm_esc(label) + '</option>';
    });
    html += '</optgroup>';
  }

  html += '<optgroup label="──────────"><option value="__otro__">Otro / texto libre</option></optgroup>';

  selectEl.innerHTML = html;

  if (valorActual) {
    // Intentar seleccionar el valor en la lista
    var encontrado = false;
    for (var i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === valorActual) {
        selectEl.value = valorActual;
        encontrado = true;
        break;
      }
    }
    if (!encontrado) {
      selectEl.value = '__otro__';
    }
  }
}
