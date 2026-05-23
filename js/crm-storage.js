/**
 * crm-storage.js
 * Capa de acceso a datos del módulo CRM.
 * Opera directamente contra Supabase — no modifica ni depende de AppData.
 *
 * Tablas: contactos_crm, casos_crm, interacciones_crm
 * Campos en snake_case (como vienen de Supabase, sin conversión).
 *
 * FUNCIONES PÚBLICAS:
 *   crm_loadAll()                                    → { contactos, casos, interacciones, casoContactos }
 *   crm_saveContacto(contacto)                       → contacto guardado
 *   crm_deleteContacto(id)                           → void
 *   crm_saveCaso(caso)                               → caso guardado
 *   crm_deleteCaso(id)                               → void
 *   crm_saveInteraccion(interaccion)                 → interaccion guardada
 *   crm_deleteInteraccion(id)                        → void
 *   crm_actualizarUltimaActividad(casoId, ...)       → void
 *   crm_addContactoACaso(casoId, contactoId)         → void
 *   crm_removeContactoDeCaso(casoId, contactoId)     → void
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function _crm_sb() {
  var sb = getSupabase();
  if (!sb) throw new Error('Supabase no disponible.');
  return sb;
}

async function _crm_uid() {
  var uid = await getCurrentUserId();
  if (!uid) throw new Error('Sin sesión activa.');
  return uid;
}

// ── Carga completa ────────────────────────────────────────────────────────────

/**
 * Carga todos los datos CRM del usuario en paralelo.
 * @returns {Promise<{contactos: Array, casos: Array, interacciones: Array}>}
 */
async function crm_loadAll() {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var resultados = await Promise.all([
    sb.from('contactos_crm')
      .select('*')
      .eq('user_id', uid)
      .order('nombre', { ascending: true }),
    sb.from('casos_crm')
      .select('*')
      .eq('user_id', uid)
      .order('fecha_ultima_actividad', { ascending: false }),
    sb.from('interacciones_crm')
      .select('*')
      .eq('user_id', uid)
      .order('fecha', { ascending: false }),
    sb.from('caso_contactos_crm')
      .select('*')
      .eq('user_id', uid)
  ]);

  if (resultados[0].error) throw resultados[0].error;
  if (resultados[1].error) throw resultados[1].error;
  if (resultados[2].error) throw resultados[2].error;
  // caso_contactos_crm puede no existir si aún no se ejecutó la migración v2 — degradar silenciosamente
  var casoContactos = resultados[3].error ? [] : (resultados[3].data || []);

  return {
    contactos:     resultados[0].data || [],
    casos:         resultados[1].data || [],
    interacciones: resultados[2].data || [],
    casoContactos: casoContactos
  };
}

// ── Contactos ─────────────────────────────────────────────────────────────────

/**
 * Inserta o actualiza un contacto.
 * Si tiene `id` → update. Si no → insert.
 * @param {Object} contacto
 * @returns {Promise<Object>} contacto persistido
 */
async function crm_saveContacto(contacto) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var data = Object.assign({}, contacto, { user_id: uid });

  var resultado;
  if (data.id) {
    data.updated_at = new Date().toISOString();
    resultado = await sb.from('contactos_crm')
      .update(data)
      .eq('id', data.id)
      .eq('user_id', uid)
      .select()
      .single();
  } else {
    delete data.id;
    resultado = await sb.from('contactos_crm')
      .insert(data)
      .select()
      .single();
  }

  if (resultado.error) throw resultado.error;
  return resultado.data;
}

/**
 * Elimina un contacto (y sus casos e interacciones por CASCADE en DB).
 * @param {string} id UUID del contacto
 */
async function crm_deleteContacto(id) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();
  var resultado = await sb.from('contactos_crm').delete().eq('id', id).eq('user_id', uid);
  if (resultado.error) throw resultado.error;
}

// ── Casos ─────────────────────────────────────────────────────────────────────

/**
 * Inserta o actualiza un caso.
 * @param {Object} caso
 * @returns {Promise<Object>} caso persistido
 */
async function crm_saveCaso(caso) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var data = Object.assign({}, caso, { user_id: uid });

  var resultado;
  if (data.id) {
    data.updated_at = new Date().toISOString();
    resultado = await sb.from('casos_crm')
      .update(data)
      .eq('id', data.id)
      .eq('user_id', uid)
      .select()
      .single();
  } else {
    delete data.id;
    resultado = await sb.from('casos_crm')
      .insert(data)
      .select()
      .single();
  }

  if (resultado.error) throw resultado.error;
  return resultado.data;
}

/**
 * Elimina un caso (y sus interacciones por CASCADE).
 * @param {string} id UUID del caso
 */
async function crm_deleteCaso(id) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();
  var resultado = await sb.from('casos_crm').delete().eq('id', id).eq('user_id', uid);
  if (resultado.error) throw resultado.error;
}

// ── Interacciones ─────────────────────────────────────────────────────────────

/**
 * Inserta una nueva interacción (las interacciones no se editan).
 * @param {Object} interaccion
 * @returns {Promise<Object>} interaccion persistida
 */
async function crm_saveInteraccion(interaccion) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var data = Object.assign({}, interaccion, { user_id: uid });
  delete data.id; // siempre insert

  var resultado = await sb.from('interacciones_crm').insert(data).select().single();
  if (resultado.error) throw resultado.error;
  return resultado.data;
}

/**
 * Elimina una interacción.
 * @param {string} id UUID de la interacción
 */
async function crm_deleteInteraccion(id) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();
  var resultado = await sb.from('interacciones_crm').delete().eq('id', id).eq('user_id', uid);
  if (resultado.error) throw resultado.error;
}

/**
 * Actualiza fecha_ultima_actividad de un caso y opcionalmente proxima_accion.
 * Se llama después de registrar una interacción.
 *
 * @param {string}      casoId
 * @param {string|null} proxAccion      texto de próxima acción (null = no cambiar)
 * @param {string|null} fechaProxAccion YYYY-MM-DD (null = no cambiar)
 */
async function crm_actualizarUltimaActividad(casoId, proxAccion, fechaProxAccion) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var patch = {
    fecha_ultima_actividad: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (proxAccion !== null && proxAccion !== undefined) {
    patch.proxima_accion = proxAccion;
    // Al asignar una nueva acción, marcarla como pendiente
    patch.accion_completada = false;
  }
  if (fechaProxAccion !== null && fechaProxAccion !== undefined) {
    patch.fecha_proxima_accion = fechaProxAccion || null;
  }

  var resultado = await sb.from('casos_crm')
    .update(patch)
    .eq('id', casoId)
    .eq('user_id', uid);

  if (resultado.error) console.warn('[crm-storage] actualizarUltimaActividad:', resultado.error.message);
}

// ── Contactos por caso (tabla de unión) ───────────────────────────────────────

/**
 * Agrega un contacto a un caso (tabla de unión caso_contactos_crm).
 * Si ya existe la relación, no hace nada.
 * @param {string} casoId
 * @param {string} contactoId
 */
async function crm_addContactoACaso(casoId, contactoId) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  var resultado = await sb.from('caso_contactos_crm')
    .upsert({ user_id: uid, caso_id: casoId, contacto_id: contactoId },
             { onConflict: 'caso_id,contacto_id', ignoreDuplicates: true })
    .select()
    .single();

  if (resultado.error && resultado.error.code !== '23505') throw resultado.error;
  return resultado.data;
}

/**
 * Quita un contacto de un caso.
 * Valida que no sea el último contacto (requiere al menos uno).
 * @param {string} casoId
 * @param {string} contactoId
 */
async function crm_removeContactoDeCaso(casoId, contactoId) {
  var sb  = _crm_sb();
  var uid = await _crm_uid();

  // Verificar que queden más contactos
  var countRes = await sb.from('caso_contactos_crm')
    .select('id', { count: 'exact', head: true })
    .eq('caso_id', casoId)
    .eq('user_id', uid);

  if ((countRes.count || 0) <= 1) {
    throw new Error('El caso debe tener al menos un contacto.');
  }

  var resultado = await sb.from('caso_contactos_crm')
    .delete()
    .eq('caso_id', casoId)
    .eq('contacto_id', contactoId)
    .eq('user_id', uid);

  if (resultado.error) throw resultado.error;

  // Si era el contacto principal del caso, actualizar contacto_id al primero disponible
  var casoRes = await sb.from('casos_crm').select('contacto_id').eq('id', casoId).single();
  if (!casoRes.error && casoRes.data && casoRes.data.contacto_id === contactoId) {
    var restantes = await sb.from('caso_contactos_crm')
      .select('contacto_id')
      .eq('caso_id', casoId)
      .eq('user_id', uid)
      .limit(1)
      .single();
    if (!restantes.error && restantes.data) {
      await sb.from('casos_crm')
        .update({ contacto_id: restantes.data.contacto_id, updated_at: new Date().toISOString() })
        .eq('id', casoId)
        .eq('user_id', uid);
    }
  }
}
