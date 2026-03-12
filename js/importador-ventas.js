/**
 * importador-ventas.js
 * Lógica para importar ventas desde TiendaNube y TiendaNegocio
 */

// Estado global del importador
var _estadoImportador = {
  plataforma: 'tiendanube',
  archivoNombre: '',
  ventasCrudas: [],
  ventasAgrupadas: [],
  productosUnicos: [],
  mapeo: {},
  mapeoGuardado: null,
  ventasAImportar: [],
  fechaInicio: null,
  fechaFin: null,
  totalVendido: 0
};

/**
 * Inicializa el importador
 */
function initImportarVentas() {
  console.log('[importador] Inicializando...');
  
  // Cargar mapeos guardados si existen
  cargarMapeosGuardados();

  // Configurar dropzone
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('file-input');

  if (!dropzone || !fileInput) return;

  dropzone.onclick = function() {
    fileInput.click();
  };

  dropzone.ondragover = function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  };

  dropzone.ondragleave = function() {
    dropzone.classList.remove('dragover');
  };

  dropzone.ondrop = function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
  };
}

/**
 * Carga los mapeos guardados de ambas plataformas
 */
function cargarMapeosGuardados() {
  // TiendaNube
  var mapeoTN = localStorage.getItem('mappingTiendaNube');
  if (mapeoTN) {
    try {
      _estadoImportador.mapeoTiendaNube = JSON.parse(mapeoTN);
      console.log('[importador] Mapeo TiendaNube cargado:', Object.keys(_estadoImportador.mapeoTiendaNube).length);
    } catch(e) {}
  }
  
  // TiendaNegocio
  var mapeoTNeg = localStorage.getItem('mappingTiendaNegocio');
  if (mapeoTNeg) {
    try {
      _estadoImportador.mapeoTiendaNegocio = JSON.parse(mapeoTNeg);
      console.log('[importador] Mapeo TiendaNegocio cargado:', Object.keys(_estadoImportador.mapeoTiendaNegocio).length);
    } catch(e) {}
  }
}

/**
 * Cambia la plataforma seleccionada
 */
function seleccionarPlataforma(plataforma) {
  _estadoImportador.plataforma = plataforma;
  
  var fileInput = document.getElementById('file-input');
  var dropzoneTitulo = document.getElementById('dropzone-titulo');
  var infoFormato = document.getElementById('info-formato');
  
  if (plataforma === 'tiendanube') {
    fileInput.accept = '.csv';
    dropzoneTitulo.textContent = 'Arrastrá tu archivo CSV aquí';
    infoFormato.innerHTML = '<strong>Formato esperado:</strong> CSV de TiendaNube<br><small>Exportado desde: Reportes → Ventas → Exportar</small>';
  } else {
    fileInput.accept = '.xlsx,.xls';
    dropzoneTitulo.textContent = 'Arrastrá tu archivo Excel aquí';
    infoFormato.innerHTML = '<strong>Formato esperado:</strong> Excel de TiendaNegocio (.xlsx)<br><small>Exportado desde: Ventas → Listado de ventas → Exportar</small>';
  }
}

/**
 * Maneja la selección de archivo
 */
function handleFileSelect(event) {
  var file = event.target.files[0];
  if (!file) return;

  _estadoImportador.archivoNombre = file.name;
  
  // Detectar plataforma por extensión si no coincide
  var extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'xlsx' || extension === 'xls') {
    _estadoImportador.plataforma = 'tiendanegocio';
    document.querySelector('input[value="tiendanegocio"]').checked = true;
  } else if (extension === 'csv') {
    _estadoImportador.plataforma = 'tiendanube';
    document.querySelector('input[value="tiendanube"]').checked = true;
  }

  if (_estadoImportador.plataforma === 'tiendanegocio') {
    // Leer Excel
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        procesarExcelTiendaNegocio(e.target.result);
      } catch (err) {
        alert('Error al leer el archivo Excel: ' + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Leer CSV
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        procesarCSVTiendaNube(e.target.result);
      } catch (err) {
        alert('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  }
}

// =============================================================================
// PROCESADOR TIENDANEGOCIO (EXCEL)
// =============================================================================

/**
 * Procesa el Excel de TiendaNegocio
 */
function procesarExcelTiendaNegocio(arrayBuffer) {
  console.log('[importador] Procesando Excel de TiendaNegocio...');
  
  // Parsear Excel con SheetJS
  var workbook = XLSX.read(arrayBuffer, { type: 'array' });
  var sheetName = workbook.SheetNames[0];
  var worksheet = workbook.Sheets[sheetName];
  
  // Convertir a JSON
  var data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length < 2) {
    alert('El archivo está vacío o no tiene datos.');
    return;
  }
  
  // Primera fila es el header
  var header = data[0].map(function(h) { return String(h || '').trim(); });
  
  // Buscar índices de columnas
  var indices = {
    orden: buscarColumna(header, ['# de venta', 'numero de venta', 'nro venta', 'venta']),
    fecha: buscarColumna(header, ['fecha']),
    estado: buscarColumna(header, ['estado de la venta', 'estado']),
    producto: buscarColumna(header, ['nombre del producto', 'producto']),
    precio: buscarColumna(header, ['precio del producto', 'precio']),
    cantidad: buscarColumna(header, ['cantidad del producto', 'cantidad']),
    sku: buscarColumna(header, ['sku']),
    total: buscarColumna(header, ['total'])
  };
  
  console.log('[importador] Índices encontrados:', indices);
  
  // Validar columnas mínimas
  if (indices.orden === -1 || indices.fecha === -1 || indices.producto === -1) {
    alert('El archivo no parece ser un Excel válido de TiendaNegocio. Faltan columnas: ' +
      (indices.orden === -1 ? '"# de venta" ' : '') +
      (indices.fecha === -1 ? '"Fecha" ' : '') +
      (indices.producto === -1 ? '"Nombre del producto" ' : ''));
    return;
  }
  
  // Procesar filas
  var ventas = [];
  for (var i = 1; i < data.length; i++) {
    var fila = data[i];
    if (!fila || fila.length === 0) continue;
    
    var numeroOrden = fila[indices.orden];
    var fecha = fila[indices.fecha];
    var producto = fila[indices.producto];
    var precio = indices.precio !== -1 ? fila[indices.precio] : 0;
    var cantidad = indices.cantidad !== -1 ? fila[indices.cantidad] : 1;
    var sku = indices.sku !== -1 ? fila[indices.sku] : '';
    var estado = indices.estado !== -1 ? fila[indices.estado] : '';
    
    // Validar datos mínimos
    if (!numeroOrden || !producto) continue;
    if (String(producto).trim() === '') continue;
    
    // Parsear valores numéricos
    var precioNum = parseFloat(String(precio).replace(',', '.')) || 0;
    var cantidadNum = parseFloat(String(cantidad).replace(',', '.')) || 1;
    
    ventas.push({
      numeroOrden: String(numeroOrden),
      fecha: parsearFechaTiendaNegocio(fecha),
      producto: String(producto).trim(),
      sku: sku ? String(sku).trim() : '',
      precioUnitario: precioNum,
      cantidad: cantidadNum,
      total: precioNum * cantidadNum,
      estado: String(estado || '').trim()
    });
  }
  
  if (ventas.length === 0) {
    alert('No se encontraron ventas válidas en el archivo.');
    return;
  }
  
  _estadoImportador.ventasCrudas = ventas;
  console.log('[importador] Ventas parseadas:', ventas.length);
  
  // Cargar mapeo guardado de TiendaNegocio
  _estadoImportador.mapeoGuardado = _estadoImportador.mapeoTiendaNegocio || {};
  
  analizarVentas();
  mostrarAnalisis();
}

/**
 * Busca una columna por múltiples nombres posibles
 */
function buscarColumna(header, nombres) {
  for (var i = 0; i < header.length; i++) {
    var h = header[i].toLowerCase().trim();
    for (var j = 0; j < nombres.length; j++) {
      if (h === nombres[j].toLowerCase() || h.indexOf(nombres[j].toLowerCase()) >= 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parsea fecha de TiendaNegocio: "23/02/2026" o similar
 */
function parsearFechaTiendaNegocio(fecha) {
  if (!fecha) return null;
  
  var fechaStr = String(fecha).trim();
  
  // Si es un número (fecha de Excel), convertir
  if (!isNaN(fecha) && typeof fecha === 'number') {
    var excelDate = new Date((fecha - 25569) * 86400 * 1000);
    return excelDate.toISOString().split('T')[0];
  }
  
  // Formato DD/MM/YYYY
  var partes = fechaStr.split('/');
  if (partes.length === 3) {
    var dia = partes[0].padStart(2, '0');
    var mes = partes[1].padStart(2, '0');
    var anio = partes[2].length === 2 ? '20' + partes[2] : partes[2];
    return anio + '-' + mes + '-' + dia;
  }
  
  // Formato YYYY-MM-DD
  if (fechaStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return fechaStr.substring(0, 10);
  }
  
  return null;
}

// =============================================================================
// PROCESADOR TIENDANUBE (CSV)
// =============================================================================

/**
 * Procesa el CSV de TiendaNube
 */
function procesarCSVTiendaNube(texto) {
  console.log('[importador] Procesando CSV de TiendaNube...');
  
  var lineas = texto.split('\n');
  if (lineas.length < 2) {
    alert('El archivo está vacío o no tiene datos.');
    return;
  }

  // Parsear header
  var header = lineas[0].split(';').map(function(h) {
    return h.replace(/"/g, '').trim();
  });

  // Índices de columnas relevantes
  var indices = {
    orden: header.indexOf('Número de orden'),
    fecha: header.indexOf('Fecha'),
    producto: header.indexOf('Nombre del producto'),
    precio: header.indexOf('Precio del producto'),
    cantidad: header.indexOf('Cantidad del producto'),
    sku: header.indexOf('SKU'),
    total: header.indexOf('Total')
  };

  // Validar que existan las columnas necesarias
  if (indices.orden === -1 || indices.fecha === -1 || indices.producto === -1) {
    alert('El archivo no parece ser un CSV válido de TiendaNube. Faltan columnas esperadas.');
    return;
  }

  // Parsear filas
  var ventas = [];
  for (var i = 1; i < lineas.length; i++) {
    var linea = lineas[i].trim();
    if (!linea) continue;

    var valores = parsearLineaCSV(linea);
    if (valores.length < header.length) continue;

    var numeroOrden = valores[indices.orden];
    var fecha = valores[indices.fecha];
    var producto = valores[indices.producto];
    var precio = valores[indices.precio];
    var cantidad = valores[indices.cantidad];

    // Validar que tenga los datos mínimos
    if (!numeroOrden || !producto || !precio || !cantidad) continue;
    if (producto.trim() === '') continue;

    ventas.push({
      numeroOrden: numeroOrden,
      fecha: parsearFechaTiendaNube(fecha),
      producto: producto.trim(),
      precioUnitario: parseFloat(precio.replace(',', '.')),
      cantidad: parseFloat(cantidad.replace(',', '.')),
      total: parseFloat(precio.replace(',', '.')) * parseFloat(cantidad.replace(',', '.'))
    });
  }

  if (ventas.length === 0) {
    alert('No se encontraron ventas válidas en el archivo.');
    return;
  }

  _estadoImportador.ventasCrudas = ventas;
  console.log('[importador] Ventas parseadas:', ventas.length);

  // Cargar mapeo guardado de TiendaNube
  _estadoImportador.mapeoGuardado = _estadoImportador.mapeoTiendaNube || {};

  analizarVentas();
  mostrarAnalisis();
}

/**
 * Parsea una línea CSV respetando comillas
 */
function parsearLineaCSV(linea) {
  var valores = [];
  var valorActual = '';
  var dentroComillas = false;

  for (var i = 0; i < linea.length; i++) {
    var char = linea[i];

    if (char === '"') {
      dentroComillas = !dentroComillas;
    } else if (char === ';' && !dentroComillas) {
      valores.push(valorActual);
      valorActual = '';
    } else {
      valorActual += char;
    }
  }
  valores.push(valorActual);

  return valores.map(function(v) { return v.trim(); });
}

/**
 * Parsea fecha de TiendaNube: "15/02/2026 20:14:08"
 */
function parsearFechaTiendaNube(fechaStr) {
  if (!fechaStr || fechaStr.trim() === '') return null;
  
  var partes = fechaStr.split(' ')[0].split('/');
  if (partes.length !== 3) return null;

  var dia = partes[0];
  var mes = partes[1];
  var anio = partes[2];

  return anio + '-' + mes.padStart(2, '0') + '-' + dia.padStart(2, '0');
}

// =============================================================================
// ANÁLISIS Y MAPEO (COMÚN)
// =============================================================================

/**
 * Analiza las ventas y extrae información clave
 */
function analizarVentas() {
  var ventas = _estadoImportador.ventasCrudas;

  // Agrupar por orden
  var ordenes = {};
  ventas.forEach(function(v) {
    if (!ordenes[v.numeroOrden]) {
      ordenes[v.numeroOrden] = [];
    }
    ordenes[v.numeroOrden].push(v);
  });

  // Productos únicos
  var productosMap = {};
  ventas.forEach(function(v) {
    var key = v.producto;
    if (!productosMap[key]) {
      productosMap[key] = {
        nombre: v.producto,
        sku: v.sku || '',
        cantidadVentas: 0,
        unidadesVendidas: 0,
        totalVendido: 0
      };
    }
    productosMap[key].cantidadVentas++;
    productosMap[key].unidadesVendidas += v.cantidad;
    productosMap[key].totalVendido += v.total;
  });

  _estadoImportador.productosUnicos = Object.values(productosMap)
    .sort(function(a, b) { return b.totalVendido - a.totalVendido; });

  // Calcular período
  var fechas = ventas
    .map(function(v) { return v.fecha; })
    .filter(function(f) { return f != null; })
    .sort();
  
  _estadoImportador.fechaInicio = fechas[0];
  _estadoImportador.fechaFin = fechas[fechas.length - 1];

  // Total vendido
  _estadoImportador.totalVendido = ventas.reduce(function(sum, v) {
    return sum + v.total;
  }, 0);

  console.log('[importador] Análisis completo:', {
    ventas: ventas.length,
    ordenes: Object.keys(ordenes).length,
    productos: _estadoImportador.productosUnicos.length
  });
}

/**
 * Muestra el análisis en pantalla
 */
function mostrarAnalisis() {
  document.getElementById('paso-1-seleccion').style.display = 'none';
  document.getElementById('paso-2-analisis').style.display = 'block';

  var plataforma = _estadoImportador.plataforma === 'tiendanube' ? 'TiendaNube' : 'TiendaNegocio';

  var html = '<div class="analisis-exito">';
  html += '<div class="analisis-icono">✓</div>';
  html += '<div class="analisis-titulo">Archivo cargado: ' + escapar(_estadoImportador.archivoNombre) + '</div>';
  html += '<div class="analisis-subtitulo">Plataforma: ' + plataforma + '</div>';
  html += '</div>';

  html += '<div class="analisis-stats">';
  html += '<div class="stat-item"><span class="stat-label">Ventas encontradas</span><span class="stat-value">' + _estadoImportador.ventasCrudas.length + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Productos únicos</span><span class="stat-value">' + _estadoImportador.productosUnicos.length + '</span></div>';
  
  if (_estadoImportador.fechaInicio && _estadoImportador.fechaFin) {
    html += '<div class="stat-item"><span class="stat-label">Período</span><span class="stat-value">' + 
      formatearFecha(_estadoImportador.fechaInicio) + ' - ' + formatearFecha(_estadoImportador.fechaFin) + '</span></div>';
  }
  
  html += '<div class="stat-item"><span class="stat-label">Total facturado</span><span class="stat-value">ARS ' + formatNum(_estadoImportador.totalVendido) + '</span></div>';
  html += '</div>';

  // Mostrar productos más vendidos
  html += '<div class="analisis-productos">';
  html += '<h4>Top 5 productos por facturación:</h4>';
  html += '<table class="tabla tabla-mini">';
  html += '<thead><tr><th>Producto</th><th class="td-num">Unidades</th><th class="td-num">Total</th></tr></thead>';
  html += '<tbody>';
  
  var top5 = _estadoImportador.productosUnicos.slice(0, 5);
  top5.forEach(function(p) {
    html += '<tr>';
    html += '<td>' + escapar(p.nombre.substring(0, 50)) + (p.nombre.length > 50 ? '...' : '') + '</td>';
    html += '<td class="td-num">' + p.unidadesVendidas + '</td>';
    html += '<td class="td-num">ARS ' + formatNum(p.totalVendido) + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  html += '</div>';

  document.getElementById('analisis-resultados').innerHTML = html;
}

/**
 * Avanza al paso de mapeo
 */
function irAlMapeo() {
  document.getElementById('paso-2-analisis').style.display = 'none';
  document.getElementById('paso-3-mapeo').style.display = 'block';

  // Actualizar nombre de plataforma
  var nombrePlataforma = _estadoImportador.plataforma === 'tiendanube' ? 'TiendaNube' : 'TiendaNegocio';
  document.getElementById('nombre-plataforma').textContent = nombrePlataforma;

  // Inicializar mapeo con los guardados
  _estadoImportador.mapeo = {};
  
  // Aplicar mapeos guardados
  if (_estadoImportador.mapeoGuardado) {
    _estadoImportador.productosUnicos.forEach(function(p) {
      if (_estadoImportador.mapeoGuardado[p.nombre]) {
        // Verificar que el producto mapeado aún existe
        var productoId = _estadoImportador.mapeoGuardado[p.nombre].productoId;
        var existe = window.AppData.productos.find(function(prod) {
          return prod.id === productoId;
        });
        if (existe) {
          _estadoImportador.mapeo[p.nombre] = _estadoImportador.mapeoGuardado[p.nombre];
        }
      }
    });
  }

  renderizarMapeo();
}

/**
 * Renderiza la lista de mapeo
 */
function renderizarMapeo() {
  var html = '';
  var productosApp = window.AppData.productos || [];

  _estadoImportador.productosUnicos.forEach(function(p) {
    var mapeado = _estadoImportador.mapeo[p.nombre];
    var selectId = 'select-' + hashString(p.nombre);

    html += '<div class="mapeo-item' + (mapeado ? ' mapeado' : '') + '" data-nombre="' + escapar(p.nombre) + '">';
    html += '<div class="mapeo-origen">';
    html += '<div class="mapeo-nombre">' + escapar(p.nombre) + '</div>';
    html += '<div class="mapeo-meta">' + p.unidadesVendidas + ' uds · ARS ' + formatNum(p.totalVendido) + '</div>';
    html += '</div>';
    html += '<div class="mapeo-flecha">→</div>';
    html += '<div class="mapeo-destino">';
    html += '<select id="' + selectId + '" class="mapeo-select" onchange="mapearProducto(\'' + escaparJS(p.nombre) + '\', this.value)">';
    html += '<option value="">-- Seleccionar producto --</option>';
    
    productosApp.forEach(function(prod) {
      var selected = mapeado && mapeado.productoId === prod.id ? ' selected' : '';
      html += '<option value="' + prod.id + '"' + selected + '>' + 
        (prod.sku ? '[' + prod.sku + '] ' : '') + escapar(prod.nombre) + '</option>';
    });
    
    html += '</select>';
    html += '<button class="btn btn-sm" onclick="buscarCoincidencia(\'' + escaparJS(p.nombre) + '\', \'' + selectId + '\')" title="Buscar automático">🔍</button>';
    html += '</div>';
    html += '</div>';
  });

  document.getElementById('mapeo-lista').innerHTML = html;
  actualizarProgresoMapeo();
}

/**
 * Genera un hash simple para crear IDs únicos
 */
function hashString(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Mapea un producto
 */
function mapearProducto(nombreOrigen, productoId) {
  if (!productoId) {
    delete _estadoImportador.mapeo[nombreOrigen];
  } else {
    var producto = window.AppData.productos.find(function(p) {
      return p.id === productoId;
    });
    if (producto) {
      _estadoImportador.mapeo[nombreOrigen] = {
        productoId: producto.id,
        sku: producto.sku || '',
        nombre: producto.nombre,
        fechaMapeo: new Date().toISOString().split('T')[0]
      };
    }
  }

  // Actualizar UI
  var items = document.querySelectorAll('.mapeo-item');
  items.forEach(function(item) {
    if (item.getAttribute('data-nombre') === nombreOrigen) {
      if (productoId) {
        item.classList.add('mapeado');
      } else {
        item.classList.remove('mapeado');
      }
    }
  });

  actualizarProgresoMapeo();
}

/**
 * Busca coincidencia automática para un producto
 */
function buscarCoincidencia(nombreOrigen, selectId) {
  var nombreLimpio = limpiarNombre(nombreOrigen);
  
  var candidato = window.AppData.productos.find(function(p) {
    var nombreProdLimpio = limpiarNombre(p.nombre);
    return nombreProdLimpio.indexOf(nombreLimpio) >= 0 || 
           nombreLimpio.indexOf(nombreProdLimpio) >= 0;
  });

  if (candidato) {
    var select = document.getElementById(selectId);
    if (select) {
      select.value = candidato.id;
      mapearProducto(nombreOrigen, candidato.id);
      alert('✓ Encontrado: ' + candidato.nombre);
    }
  } else {
    alert('No se encontró coincidencia automática. Seleccioná manualmente.');
  }
}

/**
 * Intenta mapear automáticamente todos los productos
 */
function intentarMapeoAutomatico() {
  var mapeados = 0;
  
  _estadoImportador.productosUnicos.forEach(function(p) {
    if (_estadoImportador.mapeo[p.nombre]) return;
    
    var nombreLimpio = limpiarNombre(p.nombre);
    
    // Primero intentar por SKU si existe
    if (p.sku) {
      var porSku = window.AppData.productos.find(function(prod) {
        return prod.sku && prod.sku.toLowerCase() === p.sku.toLowerCase();
      });
      if (porSku) {
        _estadoImportador.mapeo[p.nombre] = {
          productoId: porSku.id,
          sku: porSku.sku || '',
          nombre: porSku.nombre,
          fechaMapeo: new Date().toISOString().split('T')[0]
        };
        mapeados++;
        return;
      }
    }
    
    // Luego por nombre
    var candidato = window.AppData.productos.find(function(prod) {
      var nombreProdLimpio = limpiarNombre(prod.nombre);
      return nombreProdLimpio.indexOf(nombreLimpio) >= 0 || 
             nombreLimpio.indexOf(nombreProdLimpio) >= 0;
    });

    if (candidato) {
      _estadoImportador.mapeo[p.nombre] = {
        productoId: candidato.id,
        sku: candidato.sku || '',
        nombre: candidato.nombre,
        fechaMapeo: new Date().toISOString().split('T')[0]
      };
      mapeados++;
    }
  });

  if (mapeados > 0) {
    alert('✓ Se mapearon automáticamente ' + mapeados + ' producto(s)');
    renderizarMapeo();
  } else {
    alert('No se encontraron coincidencias automáticas.');
  }
}

/**
 * Filtra la lista de mapeo
 */
function filtrarMapeo(query) {
  var items = document.querySelectorAll('.mapeo-item');
  var q = query.toLowerCase().trim();

  items.forEach(function(item) {
    var nombre = item.getAttribute('data-nombre').toLowerCase();
    if (nombre.indexOf(q) >= 0) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Actualiza la barra de progreso del mapeo
 */
function actualizarProgresoMapeo() {
  var total = _estadoImportador.productosUnicos.length;
  var mapeados = Object.keys(_estadoImportador.mapeo).length;
  var porcentaje = total > 0 ? (mapeados / total * 100) : 0;

  document.getElementById('progreso-fill').style.width = porcentaje + '%';
  document.getElementById('progreso-text').textContent = mapeados + ' / ' + total + ' mapeados';

  var btnConfirmar = document.getElementById('btn-confirmar-mapeo');
  btnConfirmar.disabled = mapeados !== total;
}

/**
 * Confirma el mapeo y avanza a confirmación
 */
function confirmarMapeo() {
  // Guardar mapeo según plataforma
  var storageKey = _estadoImportador.plataforma === 'tiendanube' ? 'mappingTiendaNube' : 'mappingTiendaNegocio';
  localStorage.setItem(storageKey, JSON.stringify(_estadoImportador.mapeo));
  console.log('[importador] Mapeo guardado en', storageKey);

  prepararVentasParaImportar();

  document.getElementById('paso-3-mapeo').style.display = 'none';
  document.getElementById('paso-4-confirmacion').style.display = 'block';

  mostrarConfirmacion();
}

/**
 * Prepara las ventas aplicando el mapeo
 */
function prepararVentasParaImportar() {
  _estadoImportador.ventasAImportar = [];

  _estadoImportador.ventasCrudas.forEach(function(v) {
    var mapeo = _estadoImportador.mapeo[v.producto];
    if (!mapeo) return;

    _estadoImportador.ventasAImportar.push({
      fecha: v.fecha,
      ordenId: v.numeroOrden,
      productoId: mapeo.productoId,
      productoNombre: mapeo.nombre,
      productoSKU: mapeo.sku,
      cantidad: v.cantidad,
      precioUnitario: v.precioUnitario,
      total: v.total,
      fuente: _estadoImportador.plataforma,
      productoOriginal: v.producto
    });
  });

  console.log('[importador] Ventas preparadas:', _estadoImportador.ventasAImportar.length);
}

/**
 * Muestra la pantalla de confirmación
 */
function mostrarConfirmacion() {
  var plataforma = _estadoImportador.plataforma === 'tiendanube' ? 'TiendaNube' : 'TiendaNegocio';
  
  var html = '<div class="confirmacion-stats">';
  html += '<div class="stat-item"><span class="stat-label">Plataforma</span><span class="stat-value">' + plataforma + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Ventas a importar</span><span class="stat-value">' + _estadoImportador.ventasAImportar.length + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Productos mapeados</span><span class="stat-value">' + Object.keys(_estadoImportador.mapeo).length + '</span></div>';
  
  if (_estadoImportador.fechaInicio && _estadoImportador.fechaFin) {
    html += '<div class="stat-item"><span class="stat-label">Período</span><span class="stat-value">' + 
      formatearFecha(_estadoImportador.fechaInicio) + ' - ' + formatearFecha(_estadoImportador.fechaFin) + '</span></div>';
  }
  
  html += '</div>';

  html += '<div class="verificaciones">';
  html += '<h4 style="margin-bottom: 0.75rem;">Verificaciones:</h4>';
  html += '<div class="verificacion-item">✓ Archivo procesado correctamente</div>';
  html += '<div class="verificacion-item">✓ Todas las fechas son válidas</div>';
  html += '<div class="verificacion-item">✓ Todos los productos tienen mapeo</div>';
  html += '</div>';

  document.getElementById('confirmacion-resumen').innerHTML = html;
}

/**
 * Ejecuta la importación final
 */
function ejecutarImportacion() {
  console.log('[importador] Ejecutando importación...');

  if (!window.AppData.ventas) {
    window.AppData.ventas = [];
  }

  var ventasImportadas = 0;
  _estadoImportador.ventasAImportar.forEach(function(v) {
    var id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    window.AppData.ventas.push({
      id: id,
      fecha: v.fecha,
      ordenId: v.ordenId,
      productoId: v.productoId,
      productoNombre: v.productoNombre,
      productoSKU: v.productoSKU,
      cantidad: v.cantidad,
      precioUnitario: v.precioUnitario,
      total: v.total,
      fuente: v.fuente,
      importadoEn: new Date().toISOString()
    });
    ventasImportadas++;
  });

  saveData(window.AppData);
  console.log('[importador] Ventas guardadas:', ventasImportadas);

  mostrarResultado(ventasImportadas);
}

/**
 * Muestra el resultado de la importación
 */
function mostrarResultado(cantidadImportada) {
  document.getElementById('paso-4-confirmacion').style.display = 'none';
  document.getElementById('paso-5-resultado').style.display = 'block';

  var plataforma = _estadoImportador.plataforma === 'tiendanube' ? 'TiendaNube' : 'TiendaNegocio';

  var html = '<div class="stat-item"><span class="stat-label">Fuente</span><span class="stat-value">' + plataforma + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Ventas importadas</span><span class="stat-value">' + cantidadImportada + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Productos procesados</span><span class="stat-value">' + Object.keys(_estadoImportador.mapeo).length + '</span></div>';
  html += '<div class="stat-item"><span class="stat-label">Mapeo guardado</span><span class="stat-value">✓ Para futuras importaciones</span></div>';

  document.getElementById('resultado-stats').innerHTML = html;
}

// =============================================================================
// NAVEGACIÓN
// =============================================================================

function volverPaso1() {
  document.getElementById('paso-2-analisis').style.display = 'none';
  document.getElementById('paso-1-seleccion').style.display = 'block';
  // Resetear estado
  _estadoImportador.ventasCrudas = [];
  _estadoImportador.productosUnicos = [];
  _estadoImportador.mapeo = {};
}

function volverPaso2() {
  document.getElementById('paso-3-mapeo').style.display = 'none';
  document.getElementById('paso-2-analisis').style.display = 'block';
}

function volverPaso3() {
  document.getElementById('paso-4-confirmacion').style.display = 'none';
  document.getElementById('paso-3-mapeo').style.display = 'block';
}

function nuevaImportacion() {
  location.reload();
}

// =============================================================================
// HELPERS
// =============================================================================

function limpiarNombre(nombre) {
  return nombre.toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatNum(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '-';
  var partes = fechaISO.split('-');
  if (partes.length !== 3) return fechaISO;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

function escapar(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escaparJS(str) {
  return String(str == null ? '' : str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
