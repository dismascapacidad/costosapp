/**
 * produccion.js
 * Lógica de órdenes de producción. Sin DOM.
 *
 * NUEVA ESTRUCTURA de una orden (v2 - múltiples productos):
 * {
 *   id:              string,
 *   numero:          number,          // correlativo
 *   lineas:          Array<{          // productos de la orden
 *     productoId:    string,
 *     productoNombre: string,
 *     productoSku:   string,
 *     cantidad:      number
 *   }>,
 *   cliente:         string,
 *   numeroExterno:   string,          // número de orden externo (TiendaNube, etc.)
 *   canal:           string,          // canal de venta
 *   metodoPago:      string,          // método de pago
 *   notas:           string,
 *   espontanea:      boolean,         // si es producción espontánea
 *   estado:          'pendiente' | 'finalizada',
 *   fechaCreacion:   string ISO,
 *   fechaFinalizada: string ISO | null
 * }
 *
 * COMPATIBILIDAD: Se mantiene soporte para órdenes antiguas (con productoId único)
 * mediante migración automática a la nueva estructura.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function _siguienteNumeroOrden() {
  const ordenes = window.AppData.ordenesProduccion || [];
  return ordenes.length === 0 ? 1 : Math.max(...ordenes.map(o => o.numero || 0)) + 1;
}

function _genOrdenId() {
  return 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Viabilidad (función pura — NO modifica AppData) ───────────────────────────

/**
 * Evalúa si una línea de orden puede completarse con el stock actual.
 * @param {string} productoId
 * @param {number} cantidad
 * @param {Object} [snapshotData]
 * @returns {{ ok, cubiertoPorProducto, aFabricar, faltantes }}
 */
function verificarViabilidadLinea(productoId, cantidad, snapshotData) {
  const data = snapshotData || window.AppData;
  const producto = data.productos.find(p => p.id === productoId);
  
  if (!producto) {
    return {
      ok: false,
      cubiertoPorProducto: 0,
      aFabricar: cantidad,
      faltantes: [{ nombre: 'Producto no encontrado', necesario: cantidad, disponible: 0, deficit: cantidad }]
    };
  }

  // Paso 1: cuánto cubre el stock de producto terminado
  const stockProducto = producto.stockActual || 0;
  const cubiertoPorProducto = Math.min(stockProducto, cantidad);
  const aFabricar = cantidad - cubiertoPorProducto;

  if (aFabricar === 0) {
    return { ok: true, cubiertoPorProducto, aFabricar: 0, faltantes: [] };
  }

  // Paso 2: verificar insumos para las unidades a fabricar
  const faltantes = [];
  for (const linea of (producto.insumos || [])) {
    const insumo = data.insumos.find(i => i.id === linea.insumoId);
    const necesario = linea.cantidad * aFabricar;
    const disponible = insumo ? (insumo.stockActual || 0) : 0;
    if (disponible < necesario) {
      faltantes.push({
        insumoId: linea.insumoId,
        nombre: insumo ? insumo.nombre : '(insumo eliminado)',
        unidad: insumo ? insumo.unidad : '',
        necesario,
        disponible,
        deficit: necesario - disponible
      });
    }
  }

  return {
    ok: faltantes.length === 0,
    cubiertoPorProducto,
    aFabricar,
    faltantes
  };
}

/**
 * Evalúa la viabilidad de una orden completa (todas sus líneas).
 * @param {Object} orden - Orden con lineas[]
 * @returns {{ ok, detalles: Array<{productoId, productoNombre, viabilidad}> }}
 */
function verificarViabilidadOrdenCompleta(orden) {
  const lineas = obtenerLineasOrden(orden);
  const detalles = [];
  let todoOk = true;

  for (const linea of lineas) {
    const viab = verificarViabilidadLinea(linea.productoId, linea.cantidad);
    detalles.push({
      productoId: linea.productoId,
      productoNombre: linea.productoNombre,
      productoSku: linea.productoSku,
      cantidad: linea.cantidad,
      viabilidad: viab
    });
    if (!viab.ok) todoOk = false;
  }

  return { ok: todoOk, detalles };
}

/**
 * Compatibilidad: obtiene las líneas de una orden (nueva o antigua estructura)
 */
function obtenerLineasOrden(orden) {
  if (orden.lineas && orden.lineas.length > 0) {
    return orden.lineas;
  }
  // Compatibilidad con estructura antigua
  if (orden.productoId) {
    return [{
      productoId: orden.productoId,
      productoNombre: orden.productoNombre,
      productoSku: orden.productoSku || '',
      cantidad: orden.cantidad
    }];
  }
  return [];
}

/**
 * Evalúa la viabilidad de todas las órdenes pendientes.
 * Devuelve un mapa { ordenId → resultado de verificarViabilidadOrdenCompleta }.
 */
function viabilidadOrdenesPendientes() {
  const ordenes = getOrdenesPendientes();
  const mapa = {};
  for (const o of ordenes) {
    mapa[o.id] = verificarViabilidadOrdenCompleta(o);
  }
  return mapa;
}

// Mantener compatibilidad con función antigua
function verificarViabilidadOrden(productoId, cantidad, snapshotData) {
  return verificarViabilidadLinea(productoId, cantidad, snapshotData);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Crea una orden con múltiples productos.
 * @param {Object} params
 * @param {Array<{productoId, cantidad}>} params.lineas - Productos y cantidades
 * @param {string} params.cliente
 * @param {string} params.numeroExterno
 * @param {string} params.canal
 * @param {string} params.metodoPago
 * @param {string} params.notas
 * @param {boolean} params.espontanea
 */
function crearOrden({ lineas, cliente = '', notas = '', espontanea = false, numeroExterno = '', canal = '', metodoPago = '' }) {
  if (!lineas || lineas.length === 0) {
    throw new Error('Agregá al menos un producto a la orden.');
  }

  // Validar y enriquecer líneas
  const lineasValidadas = [];
  for (const l of lineas) {
    const producto = window.AppData.productos.find(p => p.id === l.productoId);
    if (!producto) {
      throw new Error('Producto no encontrado: ' + l.productoId);
    }
    if (!l.cantidad || isNaN(l.cantidad) || l.cantidad < 1) {
      throw new Error('La cantidad debe ser al menos 1 para ' + producto.nombre);
    }
    lineasValidadas.push({
      productoId: producto.id,
      productoNombre: producto.nombre,
      productoSku: producto.sku || '',
      cantidad: parseFloat(l.cantidad)
    });
  }

  return {
    id: _genOrdenId(),
    numero: _siguienteNumeroOrden(),
    lineas: lineasValidadas,
    cliente: cliente.trim(),
    numeroExterno: numeroExterno.trim(),
    canal: canal,
    metodoPago: metodoPago,
    notas: notas.trim(),
    espontanea: espontanea,
    estado: 'pendiente',
    fechaCreacion: new Date().toISOString(),
    fechaFinalizada: null
  };
}

function agregarOrden(orden) {
  if (!window.AppData.ordenesProduccion) window.AppData.ordenesProduccion = [];
  window.AppData.ordenesProduccion.push(orden);
  saveData(window.AppData);
}

function eliminarOrden(id) {
  window.AppData.ordenesProduccion =
    (window.AppData.ordenesProduccion || []).filter(o => o.id !== id);
  saveData(window.AppData);
}

// ── Finalización ──────────────────────────────────────────────────────────────

/**
 * Finaliza una orden de producción (con múltiples productos).
 * Para cada línea:
 *   1. Descontar del stock de PRODUCTO TERMINADO lo que haya.
 *   2. Descontar INSUMOS por las unidades restantes.
 */
function finalizarOrden(ordenId) {
  const orden = (window.AppData.ordenesProduccion || []).find(o => o.id === ordenId);
  if (!orden) throw new Error('Orden no encontrada.');
  if (orden.estado === 'finalizada') throw new Error('Esta orden ya fue finalizada.');

  const lineas = obtenerLineasOrden(orden);
  const viabCompleta = verificarViabilidadOrdenCompleta(orden);
  
  if (!viabCompleta.ok) {
    let detalle = 'No hay stock suficiente:\n';
    for (const d of viabCompleta.detalles) {
      if (!d.viabilidad.ok) {
        detalle += `\n${d.productoNombre}:\n`;
        detalle += d.viabilidad.faltantes.map(f =>
          `  • ${f.nombre}: faltan ${_fmt(f.deficit)} ${f.unidad}`
        ).join('\n');
      }
    }
    throw new Error(detalle);
  }

  const motivo = `Orden de producción N° ${String(orden.numero).padStart(4, '0')}`;

  // Procesar cada línea
  for (const detalle of viabCompleta.detalles) {
    const linea = lineas.find(l => l.productoId === detalle.productoId);
    const viab = detalle.viabilidad;
    const producto = window.AppData.productos.find(p => p.id === linea.productoId);

    // Paso 1: descontar producto terminado si hay stock
    if (viab.cubiertoPorProducto > 0) {
      producto.stockActual -= viab.cubiertoPorProducto;
      window.AppData.movimientosStock.push({
        id: generateMovimientoId(),
        tipo: 'producto',
        itemId: producto.id,
        nombre: producto.nombre,
        delta: -viab.cubiertoPorProducto,
        motivo: motivo + ' — ' + producto.nombre,
        fecha: new Date().toISOString()
      });
    }

    // Paso 2: descontar insumos por las unidades a fabricar
    if (viab.aFabricar > 0) {
      for (const receta of (producto.insumos || [])) {
        const insumo = window.AppData.insumos.find(i => i.id === receta.insumoId);
        if (!insumo) continue;
        const consumo = receta.cantidad * viab.aFabricar;
        insumo.stockActual = (insumo.stockActual || 0) - consumo;
        window.AppData.movimientosStock.push({
          id: generateMovimientoId(),
          tipo: 'insumo',
          itemId: insumo.id,
          nombre: insumo.nombre,
          delta: -consumo,
          motivo: motivo + ' — ' + producto.nombre,
          fecha: new Date().toISOString()
        });
      }
    }
  }

  // Marcar como finalizada
  orden.estado = 'finalizada';
  orden.fechaFinalizada = new Date().toISOString();
  saveData(window.AppData);
}

/**
 * Finaliza una orden de producción espontánea (con múltiples productos).
 * Para cada línea:
 *   - Solo consume insumos (no descuenta producto terminado)
 *   - Incrementa el stock de producto terminado
 */
function finalizarOrdenEspontanea(ordenId) {
  const orden = (window.AppData.ordenesProduccion || []).find(o => o.id === ordenId);
  if (!orden) throw new Error('Orden no encontrada.');
  if (orden.estado === 'finalizada') throw new Error('Esta orden ya fue finalizada.');

  const lineas = obtenerLineasOrden(orden);
  const motivo = `Producción espontánea N° ${String(orden.numero).padStart(4, '0')}`;

  // Verificar insumos para TODAS las líneas primero
  const faltantesGlobal = [];
  for (const linea of lineas) {
    const producto = window.AppData.productos.find(p => p.id === linea.productoId);
    if (!producto) {
      faltantesGlobal.push({ nombre: 'Producto no encontrado: ' + linea.productoId });
      continue;
    }

    for (const receta of (producto.insumos || [])) {
      const insumo = window.AppData.insumos.find(i => i.id === receta.insumoId);
      const necesario = receta.cantidad * linea.cantidad;
      const disponible = insumo ? (insumo.stockActual || 0) : 0;
      if (disponible < necesario) {
        faltantesGlobal.push({
          producto: producto.nombre,
          nombre: insumo ? insumo.nombre : '(insumo eliminado)',
          unidad: insumo ? insumo.unidad : '',
          necesario,
          disponible,
          deficit: necesario - disponible
        });
      }
    }
  }

  if (faltantesGlobal.length > 0) {
    const detalle = faltantesGlobal.map(f =>
      `• ${f.producto ? f.producto + ' → ' : ''}${f.nombre}: faltan ${_fmt(f.deficit)} ${f.unidad || ''}`
    ).join('\n');
    throw new Error('No hay insumos suficientes para la producción espontánea:\n' + detalle);
  }

  // Ejecutar producción para cada línea
  for (const linea of lineas) {
    const producto = window.AppData.productos.find(p => p.id === linea.productoId);

    // Descontar insumos
    for (const receta of (producto.insumos || [])) {
      const insumo = window.AppData.insumos.find(i => i.id === receta.insumoId);
      if (!insumo) continue;
      const consumo = receta.cantidad * linea.cantidad;
      insumo.stockActual = (insumo.stockActual || 0) - consumo;
      window.AppData.movimientosStock.push({
        id: generateMovimientoId(),
        tipo: 'insumo',
        itemId: insumo.id,
        nombre: insumo.nombre,
        delta: -consumo,
        motivo: motivo + ' — ' + producto.nombre,
        fecha: new Date().toISOString()
      });
    }

    // Incrementar stock de producto terminado
    producto.stockActual = (producto.stockActual || 0) + linea.cantidad;
    window.AppData.movimientosStock.push({
      id: generateMovimientoId(),
      tipo: 'producto',
      itemId: producto.id,
      nombre: producto.nombre,
      delta: linea.cantidad,
      motivo: motivo + ' — ' + producto.nombre,
      fecha: new Date().toISOString()
    });
  }

  // Marcar como finalizada
  orden.estado = 'finalizada';
  orden.fechaFinalizada = new Date().toISOString();
  saveData(window.AppData);
}

// ── Getters ───────────────────────────────────────────────────────────────────

function getOrdenes() { return window.AppData.ordenesProduccion || []; }
function getOrdenesPendientes() { return getOrdenes().filter(o => o.estado === 'pendiente'); }
function getOrdenPorId(id) { return getOrdenes().find(o => o.id === id); }

/**
 * Obtiene el resumen de productos de una orden (para mostrar en tablas)
 */
function getResumenOrden(orden) {
  const lineas = obtenerLineasOrden(orden);
  const totalProductos = lineas.length;
  const totalUnidades = lineas.reduce((sum, l) => sum + l.cantidad, 0);
  
  // Nombre para mostrar: primer producto o resumen
  let nombreMostrar;
  if (totalProductos === 1) {
    nombreMostrar = lineas[0].productoNombre;
  } else {
    nombreMostrar = totalProductos + ' productos';
  }
  
  return {
    lineas,
    totalProductos,
    totalUnidades,
    nombreMostrar,
    primerProducto: lineas[0] || null
  };
}

// ── Migración ─────────────────────────────────────────────────────────────────

function migrarOrdenesProduccion() {
  if (!window.AppData.ordenesProduccion) {
    window.AppData.ordenesProduccion = [];
    saveData(window.AppData);
    return;
  }

  // Migrar órdenes antiguas a nueva estructura
  let migradas = 0;
  for (const orden of window.AppData.ordenesProduccion) {
    if (!orden.lineas && orden.productoId) {
      orden.lineas = [{
        productoId: orden.productoId,
        productoNombre: orden.productoNombre,
        productoSku: orden.productoSku || '',
        cantidad: orden.cantidad
      }];
      migradas++;
    }
  }

  if (migradas > 0) {
    console.log('[produccion] Migradas', migradas, 'órdenes a nueva estructura');
    saveData(window.AppData);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initProduccion() {
  migrarOrdenesProduccion();
  migrarCamposStock();
  console.log('[produccion] Módulo inicializado. Órdenes:', getOrdenes().length);
  if (typeof renderProduccionPage === 'function') renderProduccionPage();
}

// ── Helper formato interno ────────────────────────────────────────────────────
function _fmt(n) { return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 }); }

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIONES ADICIONALES PARA UI CON MÚLTIPLES PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica la viabilidad de múltiples líneas (para el modal)
 * Consolida todos los faltantes de insumos
 */
function verificarViabilidadOrdenMultiple(lineas) {
  const faltantesConsolidados = {};
  let todoOk = true;

  for (const linea of lineas) {
    const viab = verificarViabilidadLinea(linea.productoId, linea.cantidad);
    if (!viab.ok) {
      todoOk = false;
      for (const f of viab.faltantes) {
        const key = f.insumoId || f.nombre;
        if (!faltantesConsolidados[key]) {
          faltantesConsolidados[key] = {
            insumoId: f.insumoId,
            nombre: f.nombre,
            unidad: f.unidad,
            necesario: 0,
            disponible: f.disponible,
            deficit: 0
          };
        }
        faltantesConsolidados[key].necesario += f.necesario;
        faltantesConsolidados[key].deficit = faltantesConsolidados[key].necesario - faltantesConsolidados[key].disponible;
      }
    }
  }

  return {
    ok: todoOk,
    faltantes: Object.values(faltantesConsolidados)
  };
}

/**
 * Crea una orden con múltiples productos (alias para compatibilidad con UI)
 */
function crearOrdenMultiple(params) {
  return crearOrden(params);
}

/**
 * Finaliza una orden con múltiples productos (alias para compatibilidad con UI)
 */
function finalizarOrdenMultiple(ordenId) {
  return finalizarOrden(ordenId);
}

/**
 * Finaliza una orden espontánea con múltiples productos (alias para compatibilidad con UI)
 */
function finalizarOrdenEspontaneaMultiple(ordenId) {
  return finalizarOrdenEspontanea(ordenId);
}
