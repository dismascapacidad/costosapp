/**
 * clientes.js
 * Lógica de negocio para gestión de clientes.
 * Sin DOM, sin efectos secundarios.
 *
 * Estructura de un cliente:
 * {
 *   id:            string,
 *   nombre:        string,
 *   email:         string,
 *   telefono:      string,
 *   direccion:     string,
 *   localidad:     string,
 *   provincia:     string,
 *   codigoPostal:  string,
 *   tipo:          'consumidor' | 'distribuidor',
 *   notas:         string,
 *   fechaAlta:     string (ISO),
 *   tags:          string[] (ej: ['vip', 'mayorista']),
 * }
 */

// ── Helper ────────────────────────────────────────────────────────────────────

function generateClienteId() {
  return 'cli_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Validación ────────────────────────────────────────────────────────────────

function validarCliente({ nombre, email, telefono }) {
  if (!nombre || nombre.trim() === '')
    throw new Error('El nombre del cliente no puede estar vacío.');
  
  // Email opcional, pero si se provee debe ser válido
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim()))
      throw new Error('El formato del email no es válido.');
  }
  
  // Al menos uno de email o teléfono debe estar presente
  if ((!email || email.trim() === '') && (!telefono || telefono.trim() === ''))
    throw new Error('Debe proporcionar al menos un email o teléfono de contacto.');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo cliente (sin persistir).
 */
function crearCliente({
  nombre, email = '', telefono = '', direccion = '', localidad = '', 
  provincia = '', codigoPostal = '', tipo = 'consumidor', notas = '', tags = [],
  // Datos históricos de Tiendanube (si vienen del CSV)
  tiendanubeData = null
}) {
  validarCliente({ nombre, email, telefono });

  return {
    id:           generateClienteId(),
    nombre:       nombre.trim(),
    email:        email.trim(),
    telefono:     telefono.trim(),
    direccion:    direccion.trim(),
    localidad:    localidad.trim(),
    provincia:    provincia.trim(),
    codigoPostal: codigoPostal.trim(),
    tipo:         tipo,
    notas:        notas.trim(),
    tags:         Array.isArray(tags) ? tags : [],
    fechaAlta:    new Date().toISOString(),
    // Datos históricos de Tiendanube (si existen)
    tiendanubeData: tiendanubeData ? {
      totalConsumido:   tiendanubeData.totalConsumido || 0,
      cantidadCompras:  tiendanubeData.cantidadCompras || 0,
      ultimaCompra:     tiendanubeData.ultimaCompra || null,
    } : null,
  };
}

/**
 * Agrega un cliente a AppData y persiste.
 */
function agregarCliente(cliente) {
  if (!window.AppData.clientes) window.AppData.clientes = [];
  window.AppData.clientes.push(cliente);
  saveData(window.AppData);
}

/**
 * Actualiza un cliente existente.
 */
function actualizarCliente(id, campos) {
  const idx = (window.AppData.clientes || []).findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Cliente no encontrado.');

  const cliente = window.AppData.clientes[idx];
  const actualizado = {
    ...cliente,
    nombre:       campos.nombre       != null ? campos.nombre.trim()       : cliente.nombre,
    email:        campos.email        != null ? campos.email.trim()        : cliente.email,
    telefono:     campos.telefono     != null ? campos.telefono.trim()     : cliente.telefono,
    direccion:    campos.direccion    != null ? campos.direccion.trim()    : cliente.direccion,
    localidad:    campos.localidad    != null ? campos.localidad.trim()    : cliente.localidad,
    provincia:    campos.provincia    != null ? campos.provincia.trim()    : cliente.provincia,
    codigoPostal: campos.codigoPostal != null ? campos.codigoPostal.trim() : cliente.codigoPostal,
    tipo:         campos.tipo         != null ? campos.tipo                : cliente.tipo,
    notas:        campos.notas        != null ? campos.notas.trim()        : cliente.notas,
    tags:         campos.tags         != null ? campos.tags                : cliente.tags,
  };

  validarCliente(actualizado);
  window.AppData.clientes[idx] = actualizado;
  saveData(window.AppData);
}

/**
 * Elimina un cliente.
 */
function eliminarCliente(id) {
  window.AppData.clientes = (window.AppData.clientes || []).filter(c => c.id !== id);
  saveData(window.AppData);
}

/**
 * Obtiene todos los clientes.
 */
function getClientes() {
  return window.AppData.clientes || [];
}

/**
 * Obtiene un cliente por ID.
 */
function getClientePorId(id) {
  return (window.AppData.clientes || []).find(c => c.id === id);
}

/**
 * Obtiene un cliente por email (útil para vincular con presupuestos).
 */
function getClientePorEmail(email) {
  if (!email || email.trim() === '') return null;
  return (window.AppData.clientes || []).find(c => 
    c.email.toLowerCase() === email.trim().toLowerCase()
  );
}

// ── Vinculación con Presupuestos ──────────────────────────────────────────────

/**
 * Obtiene todos los presupuestos de un cliente.
 * Busca por coincidencia exacta de nombre (case-insensitive).
 */
function getPresupuestosDeCliente(clienteId) {
  const cliente = getClientePorId(clienteId);
  if (!cliente) return [];

  const presupuestos = window.AppData.presupuestos || [];
  return presupuestos.filter(p => 
    p.cliente.toLowerCase().trim() === cliente.nombre.toLowerCase().trim()
  );
}

/**
 * Calcula estadísticas de compra de un cliente.
 * Combina datos de Tiendanube (si existen) + presupuestos de CostosApp.
 */
function getEstadisticasCliente(clienteId) {
  const cliente = getClientePorId(clienteId);
  if (!cliente) return _estadisticasVacias();

  const presupuestos = getPresupuestosDeCliente(clienteId);
  
  // Datos de presupuestos en CostosApp
  const facturacionApp = presupuestos.reduce((sum, p) => sum + (p.total || 0), 0);
  const comprasApp     = presupuestos.length;
  
  // Datos históricos de Tiendanube (si existen)
  const facturacionTN = cliente.tiendanubeData?.totalConsumido || 0;
  const comprasTN     = cliente.tiendanubeData?.cantidadCompras || 0;
  const ultimaCompraTN = cliente.tiendanubeData?.ultimaCompra || null;
  
  // Totales combinados
  const totalCompras     = comprasApp + comprasTN;
  const facturacionTotal = facturacionApp + facturacionTN;
  const ticketPromedio   = totalCompras > 0 ? facturacionTotal / totalCompras : 0;
  
  // Última compra: la más reciente entre app y Tiendanube
  let ultimaCompra = null;
  if (presupuestos.length > 0) {
    const ordenados = [...presupuestos].sort((a, b) => 
      new Date(b.fecha) - new Date(a.fecha)
    );
    ultimaCompra = ordenados[0].fecha;
  }
  
  // Si hay fecha de Tiendanube, parsearla y comparar
  if (ultimaCompraTN) {
    const fechaTN = _parsearFechaTN(ultimaCompraTN);
    if (fechaTN) {
      // Si no hay fecha de app, o la de TN es más reciente, usar la de TN
      if (!ultimaCompra) {
        ultimaCompra = ultimaCompraTN; // Guardar como string DD/MM/YYYY
      } else {
        const fechaApp = new Date(ultimaCompra);
        if (fechaTN > fechaApp) {
          ultimaCompra = ultimaCompraTN; // Guardar como string DD/MM/YYYY
        }
      }
    }
  }

  // Productos comprados (solo de presupuestos app, no vienen del CSV)
  const productosMap = {};
  presupuestos.forEach(p => {
    (p.lineas || []).forEach(l => {
      if (productosMap[l.productoId]) {
        productosMap[l.productoId].cantidad += l.cantidad;
        productosMap[l.productoId].veces += 1;
      } else {
        productosMap[l.productoId] = {
          productoId: l.productoId,
          nombre:     l.nombre,
          sku:        l.sku,
          cantidad:   l.cantidad,
          veces:      1,
        };
      }
    });
  });

  const productosComprados = Object.values(productosMap)
    .sort((a, b) => b.veces - a.veces);

  return {
    totalCompras,
    facturacionTotal,
    ticketPromedio,
    ultimaCompra,
    productosComprados,
    // Desglose por origen
    desglose: {
      tiendanube: {
        compras:      comprasTN,
        facturacion:  facturacionTN,
      },
      costosApp: {
        compras:      comprasApp,
        facturacion:  facturacionApp,
      }
    }
  };
}

function _estadisticasVacias() {
  return {
    totalCompras:     0,
    facturacionTotal: 0,
    ticketPromedio:   0,
    ultimaCompra:     null,
    productosComprados: [],
    desglose: {
      tiendanube: { compras: 0, facturacion: 0 },
      costosApp:  { compras: 0, facturacion: 0 }
    }
  };
}

// Helper para parsear fechas de Tiendanube (formato DD/MM/YYYY)
function _parsearFechaTN(fechaStr) {
  if (!fechaStr || fechaStr.trim() === '') return null;
  const partes = fechaStr.split('/');
  if (partes.length !== 3) return null;
  // Crear fecha en formato ISO: YYYY-MM-DD
  const fecha = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
  // Verificar que sea una fecha válida
  return isNaN(fecha.getTime()) ? null : fecha;
}

// ── Importación desde CSV ─────────────────────────────────────────────────────

/**
 * Parsea un CSV de Tiendanube y retorna array de objetos cliente.
 * Tiendanube usa punto y coma (;) como separador y comillas dobles para valores.
 */
function parsearCSVClientes(csvText) {
  const lineas = csvText.split('\n').filter(l => l.trim());
  if (lineas.length < 2) throw new Error('El CSV está vacío o no tiene datos.');

  // Función helper para parsear una línea CSV con punto y coma y comillas
  function parsearLineaCSV(linea) {
    const valores = [];
    let valorActual = '';
    let dentroDeComillas = false;
    
    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      
      if (char === '"') {
        dentroDeComillas = !dentroDeComillas;
      } else if (char === ';' && !dentroDeComillas) {
        valores.push(valorActual.trim());
        valorActual = '';
      } else {
        valorActual += char;
      }
    }
    valores.push(valorActual.trim()); // Agregar el último valor
    return valores;
  }

  const header = parsearLineaCSV(lineas[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const clientes = [];

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue; // Saltar líneas vacías
    
    const valores = parsearLineaCSV(lineas[i]).map(v => v.replace(/^"|"$/g, '').trim());
    if (valores.length < 2) continue; // Saltar líneas muy incompletas

    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = valores[idx] || '';
    });

    // Mapear a estructura de cliente según columnas de Tiendanube
    try {
      const nombre = obj['Nombre y Apellido'] || obj['Nombre'] || '';
      const email  = obj['E-mail'] || obj['Email'] || '';
      
      // Saltar si no tiene ni nombre ni email
      if (!nombre && !email) continue;
      
      // Construir dirección completa (Dirección tiene \xf3)
      const partesDir = [
        obj['Direcci\u00f3n'] || obj['Dirección'],
        obj['N\u00famero'] || obj['Número'],
        obj['Piso']
      ].filter(x => x).join(' ');
      
      const totalConsumido = parseFloat((obj['Total consumido (ARS)'] || '0').replace(/,/g, '')) || 0;
      const cantCompras    = parseInt(obj['Cantidad de compras'] || '0') || 0;
      
      // La fecha real está en la columna "Fecha", no en "Última compra"
      const ultimaCompra = obj['Fecha'] || null;
      
      // Determinar tipo según monto consumido
      let tipo = 'consumidor';
      if (totalConsumido > 100000 || cantCompras >= 3) {
        tipo = 'distribuidor';
      }
      
      const notas = [
        'Importado desde Tiendanube',
        ultimaCompra ? `Última compra: ${ultimaCompra}` : null
      ].filter(x => x).join('\n');

      const cliente = crearCliente({
        nombre:       nombre || 'Cliente sin nombre',
        email:        email,
        telefono:     obj['Tel\u00e9fono'] || obj['Teléfono'] || '',
        direccion:    partesDir,
        localidad:    obj['Localidad'] || obj['Ciudad'] || '',
        provincia:    obj['Provincia / Estado'] || '',
        codigoPostal: obj['C\u00f3digo postal'] || obj['Código postal'] || '',
        tipo:         tipo,
        notas:        notas,
        tags:         ['importado', 'tiendanube'],
        tiendanubeData: {
          totalConsumido: totalConsumido,
          cantidadCompras: cantCompras,
          ultimaCompra: ultimaCompra
        }
      });
      clientes.push(cliente);
    } catch (err) {
      console.warn(`Error al parsear línea ${i}:`, err.message);
    }
  }

  return clientes;
}

/**
 * Importa clientes desde CSV y los agrega a AppData (sin duplicar).
 */
function importarClientesDesdeCSV(csvText) {
  const nuevosClientes = parsearCSVClientes(csvText);
  const existentes = getClientes();
  
  let agregados = 0;
  let omitidos = 0;

  nuevosClientes.forEach(nc => {
    // Verificar si ya existe por email
    const existe = existentes.find(e => 
      e.email && nc.email && e.email.toLowerCase() === nc.email.toLowerCase()
    );
    
    if (!existe) {
      agregarCliente(nc);
      agregados++;
    } else {
      omitidos++;
    }
  });

  return { agregados, omitidos, total: nuevosClientes.length };
}

// ── Segmentación RFM (Inteligencia Comercial) ────────────────────────────────

/**
 * Calcula el segmento RFM de un cliente.
 * Retorna objeto con segmento, scores y detalles.
 */
function calcularSegmentoRFM(clienteId) {
  const stats = getEstadisticasCliente(clienteId);
  
  if (stats.totalCompras === 0) {
    return {
      segmento: 'nuevo',
      etiqueta: 'Nuevo',
      icono: '🆕',
      color: 'neutral',
      descripcion: 'Sin compras aún',
      prioridad: 5
    };
  }

  // Calcular días desde última compra
  let diasDesdeUltimaCompra = 9999;
  if (stats.ultimaCompra) {
    const ultima = typeof stats.ultimaCompra === 'string' && stats.ultimaCompra.includes('/')
      ? _parsearFechaTN(stats.ultimaCompra)
      : new Date(stats.ultimaCompra);
    diasDesdeUltimaCompra = Math.floor((new Date() - ultima) / (1000 * 60 * 60 * 24));
  }

  const frecuencia = stats.totalCompras;
  const monetario = stats.facturacionTotal;

  // Segmentación simplificada pero efectiva
  
  // 🏆 Champions: Compran frecuente (3+), reciente (<60d) y mucho (>100k)
  if (frecuencia >= 3 && diasDesdeUltimaCompra < 60 && monetario > 100000) {
    return {
      segmento: 'champion',
      etiqueta: 'Champion',
      icono: '🏆',
      color: 'champion',
      descripcion: 'Cliente estrella',
      prioridad: 1
    };
  }

  // ⭐ Leales: Compran regular (2-3) y reciente (<90d)
  if (frecuencia >= 2 && diasDesdeUltimaCompra < 90) {
    return {
      segmento: 'leal',
      etiqueta: 'Leal',
      icono: '⭐',
      color: 'leal',
      descripcion: 'Cliente frecuente',
      prioridad: 2
    };
  }

  // 🎯 Potencial: Primera compra buena (>50k) y reciente (<90d)
  if (frecuencia === 1 && diasDesdeUltimaCompra < 90 && monetario > 50000) {
    return {
      segmento: 'potencial',
      etiqueta: 'Potencial',
      icono: '🎯',
      color: 'potencial',
      descripcion: 'Oportunidad de fidelizar',
      prioridad: 2
    };
  }

  // ⚠️ En riesgo: Compraban bien (2+) pero hace 90-180 días
  if (frecuencia >= 2 && diasDesdeUltimaCompra >= 90 && diasDesdeUltimaCompra < 180) {
    return {
      segmento: 'riesgo',
      etiqueta: 'En riesgo',
      icono: '⚠️',
      color: 'riesgo',
      descripcion: 'Hace +90 días sin comprar',
      prioridad: 1
    };
  }

  // 😴 Dormido: 180-365 días sin comprar
  if (diasDesdeUltimaCompra >= 180 && diasDesdeUltimaCompra < 365) {
    return {
      segmento: 'dormido',
      etiqueta: 'Dormido',
      icono: '😴',
      color: 'dormido',
      descripcion: 'Hace +6 meses sin comprar',
      prioridad: 3
    };
  }

  // 👋 Perdido: +365 días sin comprar
  if (diasDesdeUltimaCompra >= 365) {
    return {
      segmento: 'perdido',
      etiqueta: 'Perdido',
      icono: '👋',
      color: 'perdido',
      descripcion: 'Hace +1 año sin comprar',
      prioridad: 4
    };
  }

  // 🌱 Ocasional: 1 compra, hace +90 días
  return {
    segmento: 'ocasional',
    etiqueta: 'Ocasional',
    icono: '🌱',
    color: 'neutral',
    descripcion: 'Compra esporádica',
    prioridad: 4
  };
}

/**
 * Obtiene resumen de segmentación de todos los clientes.
 */
function getResumenSegmentos() {
  const clientes = getClientes();
  const segmentos = {
    champion: [],
    leal: [],
    potencial: [],
    riesgo: [],
    dormido: [],
    perdido: [],
    ocasional: [],
    nuevo: []
  };

  clientes.forEach(c => {
    const seg = calcularSegmentoRFM(c.id);
    segmentos[seg.segmento].push({
      id: c.id,
      nombre: c.nombre,
      segmento: seg
    });
  });

  return segmentos;
}

/**
 * Obtiene alertas y acciones sugeridas.
 */
function getAlertasComerciales() {
  const segmentos = getResumenSegmentos();
  const alertas = [];

  // Champions sin actividad reciente (no debería pasar, pero verificar)
  if (segmentos.champion.length > 0) {
    alertas.push({
      tipo: 'info',
      icono: '🏆',
      titulo: `${segmentos.champion.length} cliente${segmentos.champion.length > 1 ? 's' : ''} Champion`,
      descripcion: 'Tus mejores clientes. Mantené el contacto.',
      clientes: segmentos.champion.slice(0, 3)
    });
  }

  // Clientes en riesgo (prioridad alta)
  if (segmentos.riesgo.length > 0) {
    alertas.push({
      tipo: 'warning',
      icono: '⚠️',
      titulo: `${segmentos.riesgo.length} cliente${segmentos.riesgo.length > 1 ? 's' : ''} en riesgo`,
      descripcion: 'No compran hace +90 días. Considerá contactarlos.',
      clientes: segmentos.riesgo.slice(0, 5)
    });
  }

  // Potenciales para fidelizar
  if (segmentos.potencial.length > 0) {
    alertas.push({
      tipo: 'success',
      icono: '🎯',
      titulo: `${segmentos.potencial.length} cliente${segmentos.potencial.length > 1 ? 's' : ''} potencial${segmentos.potencial.length > 1 ? 'es' : ''}`,
      descripcion: 'Primera compra buena. Oportunidad de fidelizar.',
      clientes: segmentos.potencial.slice(0, 5)
    });
  }

  // Clientes dormidos
  if (segmentos.dormido.length > 0) {
    alertas.push({
      tipo: 'info',
      icono: '😴',
      titulo: `${segmentos.dormido.length} cliente${segmentos.dormido.length > 1 ? 's' : ''} dormido${segmentos.dormido.length > 1 ? 's' : ''}`,
      descripcion: 'Hace +6 meses sin actividad.',
      clientes: segmentos.dormido.slice(0, 3)
    });
  }

  return alertas;
}

// ── Inicialización ────────────────────────────────────────────────────────────

function initClientes() {
  // Asegurar que el campo exista en AppData
  if (!window.AppData.clientes) {
    window.AppData.clientes = [];
    saveData(window.AppData);
  }
  console.log('[clientes] Módulo inicializado. Clientes:', window.AppData.clientes.length);
}
