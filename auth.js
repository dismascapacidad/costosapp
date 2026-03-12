/**
 * auth.js
 * Autenticación con Supabase Auth.
 * Funciones: login, registro, logout, chequeo de sesión.
 *
 * Patrón: cada página llama a requireAuth() al cargar.
 * Si no hay sesión activa, redirige a login.html.
 */

// ── Chequeo de sesión ────────────────────────────────────────────────────────

/**
 * Verifica si hay una sesión activa. Si no la hay, redirige a login.html.
 * Se llama al inicio de cada página (excepto login.html).
 *
 * @returns {Promise<object|null>} usuario autenticado o null
 */
async function requireAuth() {
  var sb = getSupabase();
  if (!sb) {
    console.error('[auth] Supabase no disponible');
    _redirigirALogin();
    return null;
  }

  try {
    var result = await sb.auth.getSession();
    var session = result.data.session;

    if (!session) {
      _redirigirALogin();
      return null;
    }

    return session.user;
  } catch (err) {
    console.error('[auth] Error verificando sesión:', err);
    _redirigirALogin();
    return null;
  }
}

/**
 * Obtiene el usuario actual sin redirigir.
 * @returns {Promise<object|null>}
 */
async function getCurrentUser() {
  var sb = getSupabase();
  if (!sb) return null;

  try {
    var result = await sb.auth.getSession();
    var session = result.data.session;
    return session ? session.user : null;
  } catch (err) {
    console.error('[auth] Error obteniendo usuario:', err);
    return null;
  }
}

/**
 * Obtiene el user_id del usuario actual.
 * @returns {Promise<string|null>}
 */
async function getCurrentUserId() {
  var user = await getCurrentUser();
  return user ? user.id : null;
}

// ── Login ────────────────────────────────────────────────────────────────────

/**
 * Inicia sesión con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ok: boolean, error: string|null}>}
 */
async function loginConEmail(email, password) {
  var sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase no disponible.' };

  try {
    var result = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      return { ok: false, error: _traducirError(result.error.message) };
    }

    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Error de conexión: ' + err.message };
  }
}

// ── Registro ─────────────────────────────────────────────────────────────────

/**
 * Registra un nuevo usuario con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ok: boolean, error: string|null, confirmacion: boolean}>}
 */
async function registrarConEmail(email, password) {
  var sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase no disponible.', confirmacion: false };

  try {
    var result = await sb.auth.signUp({
      email: email,
      password: password
    });

    if (result.error) {
      return { ok: false, error: _traducirError(result.error.message), confirmacion: false };
    }

    // Supabase puede requerir confirmación por email
    var necesitaConfirmacion = !result.data.session;

    return {
      ok: true,
      error: null,
      confirmacion: necesitaConfirmacion
    };
  } catch (err) {
    return { ok: false, error: 'Error de conexión: ' + err.message, confirmacion: false };
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────

/**
 * Cierra la sesión y redirige a login.html.
 */
async function logout() {
  var sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  _redirigirALogin();
}

// ── Helpers privados ─────────────────────────────────────────────────────────

function _redirigirALogin() {
  // Evitar bucle infinito si ya estamos en login.html
  if (window.location.pathname.indexOf('login.html') !== -1) return;
  window.location.href = 'login.html';
}

/**
 * Traduce los mensajes de error de Supabase Auth a español.
 */
function _traducirError(msg) {
  if (!msg) return 'Error desconocido.';
  var m = msg.toLowerCase();

  if (m.indexOf('invalid login credentials') !== -1)
    return 'Email o contraseña incorrectos.';
  if (m.indexOf('email not confirmed') !== -1)
    return 'Revisá tu email y confirmá tu cuenta antes de iniciar sesión.';
  if (m.indexOf('user already registered') !== -1)
    return 'Ya existe una cuenta con ese email.';
  if (m.indexOf('password') !== -1 && m.indexOf('6') !== -1)
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.indexOf('rate limit') !== -1)
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
  if (m.indexOf('network') !== -1 || m.indexOf('fetch') !== -1)
    return 'Error de conexión. Verificá tu internet.';

  return msg; // Si no hay traducción, mostrar el original
}
