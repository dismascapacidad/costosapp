/**
 * mobile.js
 * Navegación mobile para CostosApp
 * - Hamburger menu
 * - Sidebar como overlay
 * - Cierre con tap fuera o swipe
 */

(function() {
  'use strict';

  // Solo ejecutar en mobile
  function isMobile() {
    return window.innerWidth <= 700;
  }

  // Crear elementos de navegación mobile
  function initMobileNav() {
    // No hacer nada si ya existe
    if (document.getElementById('hamburger-btn')) return;

    // 1. Crear botón hamburger
    var hamburger = document.createElement('button');
    hamburger.id = 'hamburger-btn';
    hamburger.className = 'hamburger-btn';
    hamburger.setAttribute('aria-label', 'Abrir menú');
    hamburger.innerHTML = '☰';
    document.body.appendChild(hamburger);

    // 2. Crear overlay oscuro
    var overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // 3. Agregar botón cerrar al sidebar
    var sidebar = document.querySelector('.sidebar');
    if (sidebar && !sidebar.querySelector('.sidebar-close')) {
      var closeBtn = document.createElement('button');
      closeBtn.className = 'sidebar-close';
      closeBtn.setAttribute('aria-label', 'Cerrar menú');
      closeBtn.innerHTML = '✕';
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
      
      closeBtn.addEventListener('click', closeSidebar);
    }

    // 4. Event listeners
    hamburger.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);

    // 5. Cerrar con Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSidebar();
    });

    // 6. Cerrar al hacer click en un link del sidebar
    if (sidebar) {
      sidebar.querySelectorAll('nav a').forEach(function(link) {
        link.addEventListener('click', function() {
          // Pequeño delay para que se vea el click
          setTimeout(closeSidebar, 100);
        });
      });
    }

    // 7. Actualizar visibilidad según tamaño
    updateVisibility();
    window.addEventListener('resize', updateVisibility);
  }

  function toggleSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var hamburger = document.getElementById('hamburger-btn');
    
    if (sidebar && overlay) {
      var isOpen = sidebar.classList.contains('open');
      
      if (isOpen) {
        closeSidebar();
      } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        hamburger.innerHTML = '✕';
        hamburger.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }
  }

  function closeSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var hamburger = document.getElementById('hamburger-btn');
    
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (hamburger) {
      hamburger.innerHTML = '☰';
      hamburger.classList.remove('open');
    }
    document.body.style.overflow = '';
  }

  function updateVisibility() {
    var hamburger = document.getElementById('hamburger-btn');
    var overlay = document.getElementById('sidebar-overlay');
    
    if (isMobile()) {
      if (hamburger) hamburger.style.display = 'flex';
      closeSidebar(); // Asegurar que está cerrado al cambiar a mobile
    } else {
      if (hamburger) hamburger.style.display = 'none';
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }

  // Exponer para debug
  window.toggleSidebar = toggleSidebar;
  window.closeSidebar = closeSidebar;
})();
