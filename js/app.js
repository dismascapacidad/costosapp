/**
 * app.js
 * Punto de entrada de la aplicación.
 * Inicializa AppData global, verifica autenticación, configura navegación.
 *
 * CAMBIO SUPABASE: Ahora verifica sesión antes de inicializar.
 * Si no hay sesión → redirige a login.html.
 */

window.AppData = null;

/**
 * Inicializa la aplicación.
 * Se ejecuta en cada página al cargar el DOM.
 */
async function initApp() {
  // 1. Verificar autenticación
  if (typeof requireAuth === 'function') {
    var user = await requireAuth();
    if (!user) return; // requireAuth redirige a login.html
  }

  // 2. Cargar datos persistidos (o defaults si es primera vez)
  window.AppData = loadData();

  // 3. Marcar el ítem de nav activo según la página actual
  highlightActiveNav();

  // 4. Agregar botón de logout a la sidebar
  _agregarBotonLogout();

  // 5. Inicializar módulos específicos de la página actual
  var page = getCurrentPage();

  if (page === 'insumos'         && typeof initInsumos         === 'function') initInsumos();
  if (page === 'productos'       && typeof initProductos       === 'function') initProductos();
  if (page === 'presupuestos'    && typeof initPresupuestos    === 'function') initPresupuestos();
  if (page === 'clientes'        && typeof initClientes        === 'function') initClientes();
  if (page === 'stock'           && typeof initStock           === 'function') initStock();
  if (page === 'produccion'      && typeof initProduccion      === 'function') initProduccion();
  if (page === 'estadisticas'    && typeof initEstadisticas    === 'function') initEstadisticas();
  if (page === 'importar-ventas' && typeof initImportarVentas  === 'function') initImportarVentas();
  if (page === 'simulador'       && typeof initSimulador       === 'function') initSimulador();

  console.log('[app] Iniciado. Versión datos:', window.AppData.version, '| Página:', page);
}

/**
 * Detecta en qué página está el usuario según el nombre del archivo HTML.
 * @returns {string} nombre de página
 */
function getCurrentPage() {
  var path = window.location.pathname;
  if (path.indexOf('insumos') !== -1)         return 'insumos';
  if (path.indexOf('productos') !== -1)       return 'productos';
  if (path.indexOf('presupuestos') !== -1)    return 'presupuestos';
  if (path.indexOf('clientes') !== -1)        return 'clientes';
  if (path.indexOf('stock') !== -1)           return 'stock';
  if (path.indexOf('produccion') !== -1)      return 'produccion';
  if (path.indexOf('estadisticas') !== -1)    return 'estadisticas';
  if (path.indexOf('importar-ventas') !== -1) return 'importar-ventas';
  if (path.indexOf('simulador') !== -1)       return 'simulador';
  return 'index';
}

/**
 * Agrega clase 'active' al enlace de nav que corresponde a la página actual.
 */
function highlightActiveNav() {
  var links = document.querySelectorAll('nav a');
  links.forEach(function(link) {
    if (link.href === window.location.href) {
      link.classList.add('active');
    }
  });
}

/**
 * Agrega un botón de logout debajo del storage-toolbar en la sidebar.
 */
function _agregarBotonLogout() {
  var toolbar = document.querySelector('.storage-toolbar');
  if (!toolbar) return;

  // Evitar duplicados
  if (document.getElementById('btn-logout')) return;

  var btnLogout = document.createElement('button');
  btnLogout.id = 'btn-logout';
  btnLogout.className = 'btn';
  btnLogout.textContent = '⏻ Cerrar sesión';
  btnLogout.onclick = function() {
    if (typeof logout === 'function') logout();
  };
  btnLogout.style.marginTop = '0.5rem';
  btnLogout.style.width = '100%';
  btnLogout.style.opacity = '0.7';
  btnLogout.style.fontSize = '0.8rem';

  toolbar.parentNode.insertBefore(btnLogout, toolbar.nextSibling);
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
