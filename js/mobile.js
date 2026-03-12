/**
 * mobile.js
 * Lógica del menú mobile: hamburger, sidebar overlay, cierre automático.
 * Se carga en todas las páginas (excepto login.html).
 */

(function() {
  // Solo activar en pantallas móviles
  // Pero crear los elementos siempre — CSS se encarga de ocultarlos en desktop

  document.addEventListener('DOMContentLoaded', function() {
    _crearHeaderMobile();
    _crearOverlay();
    _bindEventos();
  });

  function _crearHeaderMobile() {
    // Evitar duplicados
    if (document.querySelector('.mobile-header')) return;

    var header = document.createElement('div');
    header.className = 'mobile-header';

    // Hamburger
    var hamburger = document.createElement('button');
    hamburger.className = 'mobile-hamburger';
    hamburger.id = 'btn-hamburger';
    hamburger.setAttribute('aria-label', 'Abrir menú');
    hamburger.textContent = '☰';

    // Título
    var titulo = document.createElement('span');
    titulo.className = 'mobile-title';
    titulo.textContent = 'CostosApp';

    // Botón logout
    var btnLogout = document.createElement('button');
    btnLogout.className = 'mobile-logout';
    btnLogout.textContent = 'Salir';
    btnLogout.onclick = function() {
      if (typeof logout === 'function') logout();
    };

    header.appendChild(hamburger);
    header.appendChild(titulo);
    header.appendChild(btnLogout);

    // Insertar al inicio del body
    document.body.insertBefore(header, document.body.firstChild);
  }

  function _crearOverlay() {
    if (document.querySelector('.sidebar-overlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  function _bindEventos() {
    var hamburger = document.getElementById('btn-hamburger');
    var overlay = document.getElementById('sidebar-overlay');
    var sidebar = document.querySelector('.sidebar');

    if (!hamburger || !sidebar) return;

    // Abrir sidebar
    hamburger.addEventListener('click', function() {
      sidebar.classList.add('abierta');
      overlay.classList.add('activo');
      hamburger.textContent = '✕';
      hamburger.setAttribute('aria-label', 'Cerrar menú');
    });

    // Cerrar con overlay
    overlay.addEventListener('click', function() {
      _cerrarSidebar();
    });

    // Cerrar con links de navegación
    var navLinks = sidebar.querySelectorAll('nav a');
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        _cerrarSidebar();
      });
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('abierta')) {
        _cerrarSidebar();
      }
    });
  }

  function _cerrarSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var hamburger = document.getElementById('btn-hamburger');

    if (sidebar) sidebar.classList.remove('abierta');
    if (overlay) overlay.classList.remove('activo');
    if (hamburger) {
      hamburger.textContent = '☰';
      hamburger.setAttribute('aria-label', 'Abrir menú');
    }
  }

})();
