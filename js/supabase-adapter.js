/**
 * supabase-adapter.js
 * Traduce entre el formato de AppData (camelCase, JSON monolítico)
 * y las tablas de Supabase (snake_case, tablas separadas).
 *
 * FUNCIONES PÚBLICAS:
 *   cargarDatosDesdeSupabase()  → descarga todas las tablas, devuelve AppData
 *   guardarDatosEnSupabase(data) → sube AppData a las tablas correspondientes
 *   subirMigracion(data)        → sube datos de localStorage por primera vez
 */

// ── Conversión de nombres ────────────────────────────────────────────────────

/**
 * Convierte un objeto de snake_case (Supabase) a camelCase (JS).
 */
function _snakeToCamel(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_snakeToCamel);

  var result = {};
  Object.keys(obj).forEach(function(key) {
    var camelKey = key.replace(/_([a-z])/g, function(_, letter) {
      return letter.toUpperCase();
    });
    result[camelKey] = _snakeToCamel(obj[key]);
  });
  return result;
}

/**
 * Convierte un objeto de camelCase (JS) a snake_case (Supabase).
 */
function _camelToSnake(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_camelToSnake);

  var result = {};
  Object.keys(obj).forEach(function(key) {
    var snakeKey = key.replace(/[A-Z]/g, function(letter) {
      return '_' + letter.toLowerCase();
    });
    // No convertir recursivamente valores JSONB (componentes, lineas, tags, etc.)
    // porque se guardan tal cual como JSON
    result[snakeKey] = obj[key];
  });
  return result;
}

// ── Cargar datos desde Supabase → formato AppData ────────────────────────────

/**
 * Descarga todas las tablas del usuario y las ensambla en un objeto AppData
 * compatible con el formato actual de la app.
 *
 * @returns {Promise<Object>} AppData completo
 */
async function cargarDatosDesdeSupabase() {
  var sb = getSupabase();
  var userId = await getCurrentUserId();
  if (!sb || !userId) throw new Error('No hay sesión activa.');

  // Ejecutar todas las consultas en paralelo
  var resultados = await Promise.all([
    sb.from('config').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('insumos').select('*').eq('user_id', userId),
    sb.from('productos').select('*').eq('user_id', userId),
    sb.from('presupuestos').select('*').eq('user_id', userId),
    sb.from('ordenes_produccion').select('*').eq('user_id', userId),
    sb.from('movimientos_stock').select('*').eq('user_id', userId),
    sb.from('clientes').select('*').eq('user_id', userId),
    sb.from('ventas').select('*').eq('user_id', userId),
    sb.from('mapeos_productos').select('*').eq('user_id', userId),
    sb.from('cache_dolar').select('*').eq('user_id', userId).maybeSingle()
  ]);

  var config      = resultados[0].data;
  var insumos     = resultados[1].data || [];
  var productos   = resultados[2].data || [];
  var presupuestos = resultados[3].data || [];
  var ordenes     = resultados[4].data || [];
  var movimientos = resultados[5].data || [];
  var clientes    = resultados[6].data || [];
  var ventas      = resultados[7].data || [];
  var mapeos      = resultados[8].data || [];
  var cacheDolar  = resultados[9].data;

  // Ensamblar AppData en el formato que espera la app
  var appData = {
    version:            config ? config.version : 1,
    monedaBase:         config ? config.moneda_base : 'ARS',
    tipoCambioManual:   config ? Number(config.tipo_cambio_manual) : 1000,
    dolarCompra:        cacheDolar ? Number(cacheDolar.compra) : 0,
    config: {
      margenGlobalConsumidor:   config ? Number(config.margen_global_consumidor) : 45,
      margenGlobalDistribuidor: config ? Number(config.margen_global_distribuidor) : 20
    },
    insumos:            insumos.map(_convertirInsumoDesdeDB),
    productos:          productos.map(_convertirProductoDesdeDB),
    presupuestos:       presupuestos.map(_convertirPresupuestoDesdeDB),
    ordenesProduccion:  ordenes.map(_convertirOrdenDesdeDB),
    movimientosStock:   movimientos.map(_convertirMovimientoDesdeDB),
    clientes:           clientes.map(_convertirClienteDesdeDB),
    ventas:             ventas.map(_convertirVentaDesdeDB)
  };

  // Guardar mapeos en _estadoImportador si existe (para importador-ventas.js)
  if (typeof _estadoImportador !== 'undefined') {
    mapeos.forEach(function(m) {
      if (m.plataforma === 'tiendanube') {
        if (!_estadoImportador.mapeoTiendaNube) _estadoImportador.mapeoTiendaNube = {};
        _estadoImportador.mapeoTiendaNube[m.nombre_externo] = m.producto_interno_id;
      } else if (m.plataforma === 'tiendanegocio') {
        if (!_estadoImportador.mapeoTiendaNegocio) _estadoImportador.mapeoTiendaNegocio = {};
        _estadoImportador.mapeoTiendaNegocio[m.nombre_externo] = m.producto_interno_id;
      }
    });
  }

  return appData;
}

// ── Conversores DB → JS (snake_case → camelCase + tipos) ─────────────────────

/**
 * Convierte un insumo de Supabase al formato que espera la app.
 * 
 * IMPORTANTE: La app usa 'precioUnitario' como campo principal para el costo.
 * En Supabase guardamos tanto 'precio_compra' como 'costo_unitario'.
 * El 'precioUnitario' de la app equivale a 'costo_unitario' de Supabase.
 */
function _convertirInsumoDesdeDB(row) {
  // costo_unitario es el precio por unidad que usa la app para calcular costos
  var costoUnit = Number(row.costo_unitario) || 0;
  
  return {
    id:                 row.legacy_id || row.id,
    _supabaseId:        row.id,
    nombre:             row.nombre,
    categoria:          row.categoria || '',
    unidad:             row.unidad || 'u.',
    // CAMPO CRÍTICO: precioUnitario es lo que usa la app para calcular costos de productos
    precioUnitario:     costoUnit,
    // También mantener precioCompra y cantidadCompra para el cálculo interno
    precioCompra:       Number(row.precio_compra) || costoUnit,
    cantidadCompra:     Number(row.cantidad_compra) || 1,
    // costoUnitario es redundante con precioUnitario, pero lo mantenemos por compatibilidad
    costoUnitario:      costoUnit,
    moneda:             row.moneda || 'ARS',
    proveedor:          row.proveedor || '',
    stockActual:        Number(row.stock_actual) || 0,
    stockMinimo:        Number(row.stock_minimo) || 0,
    fechaActualizacion: row.fecha_actualizacion || row.created_at
  };
}

/**
 * Convierte un producto de Supabase al formato que espera la app.
 */
function _convertirProductoDesdeDB(row) {
  // Parsear componentes si viene como string JSON
  var componentes = row.componentes || [];
  if (typeof componentes === 'string') {
    try {
      componentes = JSON.parse(componentes);
    } catch (e) {
      console.warn('[adapter] Error parseando componentes:', e);
      componentes = [];
    }
  }
  
  return {
    id:                  row.legacy_id || row.id,
    _supabaseId:         row.id,
    sku:                 row.sku || '',
    nombre:              row.nombre,
    categoria:           row.categoria || '',
    // 'componentes' en Supabase = 'insumos' en la app
    insumos:             componentes,
    horasTrabajo:        Number(row.horas_trabajo) || 0,
    costoHora:           Number(row.costo_hora) || 0,
    modoConsumidor:      row.modo_consumidor || 'margen',
    margenConsumidor:    Number(row.margen_consumidor) || 45,
    precioFinal:         Number(row.precio_final) || 0,
    modoDistribuidor:    row.modo_distribuidor || 'margen',
    margenDistribuidor:  Number(row.margen_distribuidor) || 20,
    precioDistribuidor:  Number(row.precio_distribuidor) || 0,
    margenDeseado:       Number(row.margen_deseado) || 45,
    markup:              Number(row.markup) || 0,
    stockActual:         Number(row.stock_actual) || 0,
    stockMinimo:         Number(row.stock_minimo) || 0,
    fechaActualizacion:  row.fecha_actualizacion || row.created_at
  };
}

function _convertirPresupuestoDesdeDB(row) {
  // Parsear lineas si viene como string JSON
  var lineas = row.lineas || [];
  if (typeof lineas === 'string') {
    try {
      lineas = JSON.parse(lineas);
    } catch (e) {
      console.warn('[adapter] Error parseando lineas presupuesto:', e);
      lineas = [];
    }
  }
  
  return {
    id:               row.legacy_id || row.id,
    _supabaseId:      row.id,
    numero:           row.numero,
    cliente:          row.cliente || '',
    validezDias:      row.validez_dias || 15,
    tipoCliente:      row.tipo_cliente || 'consumidor',
    descuento:        Number(row.descuento) || 0,
    costoEnvio:       Number(row.costo_envio) || 0,
    lineas:           lineas,
    subtotalLineas:   Number(row.subtotal_lineas) || 0,
    montoDescuento:   Number(row.monto_descuento) || 0,
    totalSinEnvio:    Number(row.total_sin_envio) || 0,
    total:            Number(row.total) || 0,
    fecha:            row.fecha,
    fechaVencimiento: row.fecha_vencimiento
  };
}

function _convertirOrdenDesdeDB(row) {
  // Parsear lineas si viene como string JSON
  var lineas = row.lineas || [];
  if (typeof lineas === 'string') {
    try {
      lineas = JSON.parse(lineas);
    } catch (e) {
      console.warn('[adapter] Error parseando lineas orden:', e);
      lineas = [];
    }
  }
  
  return {
    id:              row.legacy_id || row.id,
    _supabaseId:     row.id,
    numero:          row.numero,
    estado:          row.estado || 'pendiente',
    cliente:         row.cliente || '',
    numeroExterno:   row.numero_externo || '',
    canal:           row.canal || '',
    metodoPago:      row.metodo_pago || '',
    notas:           row.notas || '',
    espontanea:      row.espontanea || false,
    lineas:          lineas,
    fechaCreacion:   row.fecha_creacion,
    fechaFinalizada: row.fecha_finalizada
  };
}

function _convertirMovimientoDesdeDB(row) {
  return {
    id:     row.legacy_id || row.id,
    _supabaseId: row.id,
    tipo:   row.tipo,
    itemId: row.item_id,
    nombre: row.nombre || '',
    delta:  Number(row.delta) || 0,
    motivo: row.motivo || '',
    fecha:  row.fecha,
    esNota: row.es_nota || false
  };
}

function _convertirClienteDesdeDB(row) {
  // Parsear tags si viene como string JSON
  var tags = row.tags || [];
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch (e) {
      tags = [];
    }
  }
  
  // Parsear tiendanubeData si viene como string JSON
  var tiendanubeData = row.tiendanube_data || null;
  if (typeof tiendanubeData === 'string') {
    try {
      tiendanubeData = JSON.parse(tiendanubeData);
    } catch (e) {
      tiendanubeData = null;
    }
  }
  
  return {
    id:             row.legacy_id || row.id,
    _supabaseId:    row.id,
    nombre:         row.nombre,
    email:          row.email || '',
    telefono:       row.telefono || '',
    direccion:      row.direccion || '',
    localidad:      row.localidad || '',
    provincia:      row.provincia || '',
    codigoPostal:   row.codigo_postal || '',
    tipo:           row.tipo || 'consumidor',
    notas:          row.notas || '',
    tags:           tags,
    tiendanubeData: tiendanubeData,
    fechaAlta:      row.fecha_alta || row.created_at
  };
}

function _convertirVentaDesdeDB(row) {
  return {
    id:              row.legacy_id || row.id,
    _supabaseId:     row.id,
    fecha:           row.fecha,
    ordenId:         row.orden_id || '',
    productoId:      row.producto_id || '',
    productoNombre:  row.producto_nombre || '',
    productoSKU:     row.producto_sku || '',
    cantidad:        Number(row.cantidad) || 0,
    precioUnitario:  Number(row.precio_unitario) || 0,
    total:           Number(row.total) || 0,
    fuente:          row.fuente || 'tiendanube'
  };
}

// ── Guardar AppData → Supabase ───────────────────────────────────────────────

/**
 * Guarda el AppData completo en Supabase.
 * Estrategia: borrar todo y reinsertar (simple y confiable para un solo usuario).
 *
 * @param {Object} data - AppData completo
 * @returns {Promise<boolean>} true si guardó sin errores
 */
async function guardarDatosEnSupabase(data) {
  var sb = getSupabase();
  var userId = await getCurrentUserId();
  if (!sb || !userId) return false;

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // PROTECCIÓN ANTI-BORRADO DESTRUCTIVO
    // Verificar que no estemos por borrar más datos de los que vamos a insertar
    // ═══════════════════════════════════════════════════════════════════════════
    var conteoSupabase = await Promise.all([
      sb.from('insumos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    ]);
    
    var insumosEnSupabase = conteoSupabase[0].count || 0;
    var productosEnSupabase = conteoSupabase[1].count || 0;
    var insumosAGuardar = (data.insumos || []).length;
    var productosAGuardar = (data.productos || []).length;
    
    // Si Supabase tiene datos y vamos a guardar vacío → BLOQUEAR
    if (insumosEnSupabase > 0 && insumosAGuardar === 0) {
      console.error('[supabase-adapter] ⛔ BLOQUEADO: Supabase tiene ' + insumosEnSupabase + ' insumos, no se permite guardar 0.');
      return false;
    }
    if (productosEnSupabase > 0 && productosAGuardar === 0) {
      console.error('[supabase-adapter] ⛔ BLOQUEADO: Supabase tiene ' + productosEnSupabase + ' productos, no se permite guardar 0.');
      return false;
    }
    
    // Si vamos a guardar significativamente menos datos → ADVERTIR y BLOQUEAR
    if (insumosEnSupabase > 10 && insumosAGuardar < insumosEnSupabase * 0.5) {
      console.error('[supabase-adapter] ⛔ BLOQUEADO: Supabase tiene ' + insumosEnSupabase + ' insumos, se intentó guardar solo ' + insumosAGuardar + '. Esto parece un error.');
      return false;
    }
    if (productosEnSupabase > 10 && productosAGuardar < productosEnSupabase * 0.5) {
      console.error('[supabase-adapter] ⛔ BLOQUEADO: Supabase tiene ' + productosEnSupabase + ' productos, se intentó guardar solo ' + productosAGuardar + '. Esto parece un error.');
      return false;
    }
    
    console.log('[supabase-adapter] ✓ Validación OK. Supabase: ' + insumosEnSupabase + ' insumos, ' + productosEnSupabase + ' productos. A guardar: ' + insumosAGuardar + ' insumos, ' + productosAGuardar + ' productos.');
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Config: upsert (insertar o actualizar)
    await sb.from('config').upsert({
      user_id:                    userId,
      version:                    data.version || 1,
      moneda_base:                data.monedaBase || 'ARS',
      tipo_cambio_manual:         data.tipoCambioManual || 1000,
      margen_global_consumidor:   data.config ? data.config.margenGlobalConsumidor : 45,
      margen_global_distribuidor: data.config ? data.config.margenGlobalDistribuidor : 20
    }, { onConflict: 'user_id' });

    // Para las demás tablas: borrar existentes e insertar nuevas
    // Esto es más simple que hacer diff y es seguro para un solo usuario

    // Insumos
    await sb.from('insumos').delete().eq('user_id', userId);
    if (data.insumos && data.insumos.length > 0) {
      var insumosRows = data.insumos.map(function(i) {
        // La app usa precioUnitario, lo guardamos en costo_unitario
        var costoUnit = i.precioUnitario || i.costoUnitario || 0;
        return {
          user_id:              userId,
          legacy_id:            i.id,
          nombre:               i.nombre,
          categoria:            i.categoria || '',
          unidad:               i.unidad || 'u.',
          precio_compra:        i.precioCompra || costoUnit,
          cantidad_compra:      i.cantidadCompra || 1,
          moneda:               i.moneda || 'ARS',
          proveedor:            i.proveedor || '',
          costo_unitario:       costoUnit,
          stock_actual:         i.stockActual || 0,
          stock_minimo:         i.stockMinimo || 0,
          fecha_actualizacion:  i.fechaActualizacion || new Date().toISOString()
        };
      });
      await sb.from('insumos').insert(insumosRows);
    }

    // Productos
    await sb.from('productos').delete().eq('user_id', userId);
    if (data.productos && data.productos.length > 0) {
      var productosRows = data.productos.map(function(p) {
        return {
          user_id:              userId,
          legacy_id:            p.id,
          sku:                  p.sku || '',
          nombre:               p.nombre,
          categoria:            p.categoria || '',
          componentes:          p.insumos || [],
          horas_trabajo:        p.horasTrabajo || 0,
          costo_hora:           p.costoHora || 0,
          modo_consumidor:      p.modoConsumidor || 'margen',
          margen_consumidor:    p.margenConsumidor || 45,
          precio_final:         p.precioFinal || 0,
          modo_distribuidor:    p.modoDistribuidor || 'margen',
          margen_distribuidor:  p.margenDistribuidor || 20,
          precio_distribuidor:  p.precioDistribuidor || 0,
          margen_deseado:       p.margenDeseado || 45,
          markup:               p.markup || 0,
          stock_actual:         p.stockActual || 0,
          stock_minimo:         p.stockMinimo || 0,
          fecha_actualizacion:  p.fechaActualizacion || new Date().toISOString()
        };
      });
      await sb.from('productos').insert(productosRows);
    }

    // Presupuestos
    await sb.from('presupuestos').delete().eq('user_id', userId);
    if (data.presupuestos && data.presupuestos.length > 0) {
      var presupRows = data.presupuestos.map(function(p) {
        return {
          user_id:            userId,
          legacy_id:          p.id,
          numero:             p.numero,
          cliente:            p.cliente || '',
          validez_dias:       p.validezDias || 15,
          tipo_cliente:       p.tipoCliente || 'consumidor',
          descuento:          p.descuento || 0,
          costo_envio:        p.costoEnvio || 0,
          lineas:             p.lineas || [],
          subtotal_lineas:    p.subtotalLineas || 0,
          monto_descuento:    p.montoDescuento || 0,
          total_sin_envio:    p.totalSinEnvio || 0,
          total:              p.total || 0,
          fecha:              p.fecha,
          fecha_vencimiento:  p.fechaVencimiento
        };
      });
      await sb.from('presupuestos').insert(presupRows);
    }

    // Órdenes de producción
    await sb.from('ordenes_produccion').delete().eq('user_id', userId);
    if (data.ordenesProduccion && data.ordenesProduccion.length > 0) {
      var ordenesRows = data.ordenesProduccion.map(function(o) {
        return {
          user_id:          userId,
          legacy_id:        o.id,
          numero:           o.numero,
          estado:           o.estado || 'pendiente',
          cliente:          o.cliente || '',
          numero_externo:   o.numeroExterno || '',
          canal:            o.canal || '',
          metodo_pago:      o.metodoPago || '',
          notas:            o.notas || '',
          espontanea:       o.espontanea || false,
          lineas:           o.lineas || [],
          fecha_creacion:   o.fechaCreacion,
          fecha_finalizada: o.fechaFinalizada || null
        };
      });
      await sb.from('ordenes_produccion').insert(ordenesRows);
    }

    // Movimientos de stock
    await sb.from('movimientos_stock').delete().eq('user_id', userId);
    if (data.movimientosStock && data.movimientosStock.length > 0) {
      var movRows = data.movimientosStock.map(function(m) {
        return {
          user_id:   userId,
          legacy_id: m.id,
          tipo:      m.tipo,
          item_id:   m.itemId,
          nombre:    m.nombre || '',
          delta:     m.delta || 0,
          motivo:    m.motivo || '',
          es_nota:   m.esNota || false,
          fecha:     m.fecha
        };
      });
      await sb.from('movimientos_stock').insert(movRows);
    }

    // Clientes
    await sb.from('clientes').delete().eq('user_id', userId);
    if (data.clientes && data.clientes.length > 0) {
      var clientesRows = data.clientes.map(function(c) {
        return {
          user_id:         userId,
          legacy_id:       c.id,
          nombre:          c.nombre,
          email:           c.email || '',
          telefono:        c.telefono || '',
          direccion:       c.direccion || '',
          localidad:       c.localidad || '',
          provincia:       c.provincia || '',
          codigo_postal:   c.codigoPostal || '',
          tipo:            c.tipo || 'consumidor',
          notas:           c.notas || '',
          tags:            c.tags || [],
          tiendanube_data: c.tiendanubeData || null,
          fecha_alta:      c.fechaAlta || new Date().toISOString()
        };
      });
      await sb.from('clientes').insert(clientesRows);
    }

    // Ventas
    await sb.from('ventas').delete().eq('user_id', userId);
    if (data.ventas && data.ventas.length > 0) {
      var ventasRows = data.ventas.map(function(v) {
        return {
          user_id:          userId,
          legacy_id:        v.id,
          fecha:            v.fecha,
          orden_id:         v.ordenId || '',
          producto_id:      v.productoId || '',
          producto_nombre:  v.productoNombre || '',
          producto_sku:     v.productoSKU || '',
          cantidad:         v.cantidad || 0,
          precio_unitario:  v.precioUnitario || 0,
          total:            v.total || 0,
          fuente:           v.fuente || 'tiendanube'
        };
      });
      await sb.from('ventas').insert(ventasRows);
    }

    return true;
  } catch (err) {
    console.error('[supabase-adapter] Error guardando datos:', err);
    return false;
  }
}

// ── Migración inicial desde localStorage ─────────────────────────────────────

/**
 * Sube los datos de localStorage a Supabase por primera vez.
 * También migra los mapeos de TiendaNube/TiendaNegocio.
 *
 * @param {Object} data - AppData desde localStorage
 * @returns {Promise<{ok: boolean, resumen: Object, error: string|null}>}
 */
async function subirMigracion(data) {
  var sb = getSupabase();
  var userId = await getCurrentUserId();
  if (!sb || !userId) return { ok: false, resumen: {}, error: 'No hay sesión activa.' };

  try {
    // 1. Subir datos principales
    var guardado = await guardarDatosEnSupabase(data);
    if (!guardado) throw new Error('Error guardando datos principales.');

    // 2. Migrar mapeos de productos (localStorage aparte)
    var mapeosMigrados = 0;
    var mapeoTN = null;
    var mapeoTNeg = null;

    try { mapeoTN = JSON.parse(localStorage.getItem('mappingTiendaNube')); } catch(_) {}
    try { mapeoTNeg = JSON.parse(localStorage.getItem('mappingTiendaNegocio')); } catch(_) {}

    if (mapeoTN && typeof mapeoTN === 'object') {
      var filasTN = Object.keys(mapeoTN).map(function(nombreExterno) {
        return {
          user_id:                userId,
          plataforma:             'tiendanube',
          nombre_externo:         nombreExterno,
          producto_interno_id:    mapeoTN[nombreExterno] || '',
          producto_interno_nombre: ''
        };
      });
      if (filasTN.length > 0) {
        await sb.from('mapeos_productos').insert(filasTN);
        mapeosMigrados += filasTN.length;
      }
    }

    if (mapeoTNeg && typeof mapeoTNeg === 'object') {
      var filasTNeg = Object.keys(mapeoTNeg).map(function(nombreExterno) {
        return {
          user_id:                userId,
          plataforma:             'tiendanegocio',
          nombre_externo:         nombreExterno,
          producto_interno_id:    mapeoTNeg[nombreExterno] || '',
          producto_interno_nombre: ''
        };
      });
      if (filasTNeg.length > 0) {
        await sb.from('mapeos_productos').insert(filasTNeg);
        mapeosMigrados += filasTNeg.length;
      }
    }

    // 3. Migrar caché de dólar
    var cacheDolar = null;
    try { cacheDolar = JSON.parse(localStorage.getItem('costosApp_dolarCache')); } catch(_) {}
    if (cacheDolar) {
      await sb.from('cache_dolar').upsert({
        user_id: userId,
        compra:  cacheDolar.compra || 0,
        venta:   cacheDolar.venta || cacheDolar.valor || 0,
        valor:   cacheDolar.valor || cacheDolar.venta || 0,
        fuente:  cacheDolar.fuente || 'cache',
        fecha:   cacheDolar.fecha || new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    return {
      ok: true,
      error: null,
      resumen: {
        insumos:       (data.insumos || []).length,
        productos:     (data.productos || []).length,
        presupuestos:  (data.presupuestos || []).length,
        ordenes:       (data.ordenesProduccion || []).length,
        movimientos:   (data.movimientosStock || []).length,
        clientes:      (data.clientes || []).length,
        ventas:        (data.ventas || []).length,
        mapeos:        mapeosMigrados
      }
    };
  } catch (err) {
    console.error('[supabase-adapter] Error en migración:', err);
    return { ok: false, resumen: {}, error: err.message };
  }
}
