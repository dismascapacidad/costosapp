/**
 * supabase-config.js
 * Inicializa el cliente de Supabase.
 * Se carga ANTES que storage.js y auth.js.
 *
 * La anon key es pública por diseño — la seguridad está en RLS.
 */

var SUPABASE_URL  = 'https://bvlztojamfzbplqudvim.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHp0b2phbWZ6YnBscXVkdmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzI5NjEsImV4cCI6MjA4ODg0ODk2MX0.OWhlCJSTP6uXmLF-mGLzXPRVHyofsD6_Hyk6DNyBfdM';

var _supabase = null;

/**
 * Devuelve la instancia del cliente Supabase (singleton).
 * @returns {object} cliente Supabase
 */
function getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('[supabase-config] La librería supabase-js no está cargada.');
      return null;
    }
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _supabase;
}
