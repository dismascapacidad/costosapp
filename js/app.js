/**
 * app.js
 * Punto de entrada de la aplicación.
 * Inicializa AppData global, configura navegación y expone
 * el estado centralizado accesible desde cualquier módulo.
 *
 * PATRÓN USADO:
 * AppData es el "estado" de la app. Todos los módulos lo leen/modifican
 * a través de funciones en sus propios archivos (insumos.js, productos.js, etc.)
 * y llaman a saveData() cuando necesitan persistir.
 */

/**
 * Estado global de la aplicación.
 * Se carga desde localStorage al iniciar.
 * Cualquier módulo puede leerlo con: window.AppData
 * Cualquier módulo puede guardarlo con: saveData(window.AppData)
 */
window.AppData = null;

/**
 * Inicializa la aplicación.
 * Se ejecuta en cada página al cargar el DOM.
 */
function initApp() {
  // Cargar datos persistidos (o defaults si es primera vez)
  window.AppData = loadData();

  // Marcar el ítem de nav activo según la página actual
  highlightActiveNav();

  // Inicializar módulos específicos de la página actual
  const page = getCurrentPage();
  
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
  const path = window.location.pathname;
  if (path.includes('insumos'))         return 'insumos';
  if (path.includes('productos'))       return 'productos';
  if (path.includes('presupuestos'))    return 'presupuestos';
  if (path.includes('clientes'))        return 'clientes';
  if (path.includes('stock'))           return 'stock';
  if (path.includes('produccion'))      return 'produccion';
  if (path.includes('estadisticas'))    return 'estadisticas';
  if (path.includes('importar-ventas')) return 'importar-ventas';
  if (path.includes('simulador'))       return 'simulador';
  return 'index';
}

/**
 * Agrega clase 'active' al enlace de nav que corresponde a la página actual.
 */
function highlightActiveNav() {
  const links = document.querySelectorAll('nav a');
  links.forEach(link => {
    if (link.href === window.location.href) {
      link.classList.add('active');
    }
  });
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
