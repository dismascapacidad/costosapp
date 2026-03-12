/**
 * sku.js
 * Generación y validación de SKUs.
 * Formato: 3 letras mayúsculas + 3 dígitos  (ej: VEL001, RES042)
 *
 * Funciones puras — no acceden a AppData directamente.
 */

const SKU_REGEX = /^[A-Z]{3}[0-9]{3}$/;

/**
 * Valida que un SKU cumpla el formato 3L+3N.
 * @param {string} sku
 * @returns {{ ok: boolean, error: string|null }}
 */
function validarFormatoSKU(sku) {
  if (!sku || sku.trim() === '') {
    return { ok: false, error: 'El SKU no puede estar vacío.' };
  }
  if (!SKU_REGEX.test(sku.trim())) {
    return { ok: false, error: 'El SKU debe tener 3 letras mayúsculas y 3 números (ej: VEL001).' };
  }
  return { ok: true, error: null };
}

/**
 * Verifica que un SKU no esté ya en uso.
 * @param {string} sku
 * @param {Array}  productos   - lista de productos de AppData
 * @param {string} [excluirId] - ID del producto en edición (para no fallar contra sí mismo)
 * @returns {{ ok: boolean, error: string|null }}
 */
function validarSKUUnico(sku, productos, excluirId = null) {
  const duplicado = productos.find(
    p => p.sku === sku.trim() && p.id !== excluirId
  );
  if (duplicado) {
    return { ok: false, error: `El SKU "${sku}" ya está en uso por "${duplicado.nombre}".` };
  }
  return { ok: true, error: null };
}

/**
 * Genera un SKU sugerido a partir del nombre del producto.
 * Toma las primeras 3 letras del nombre (sin espacios ni símbolos),
 * las convierte a mayúsculas, y agrega el siguiente número disponible
 * dado el conjunto de SKUs existentes.
 *
 * @param {string} nombre    - nombre del producto
 * @param {Array}  productos - productos existentes (para evitar duplicados)
 * @returns {string}         - ej: "VEL001"
 */
function generarSKUSugerido(nombre, productos) {
  // Extraer letras del nombre
  const letras = (nombre || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')   // solo letras
    .slice(0, 3)
    .padEnd(3, 'X');           // rellenar con X si el nombre es muy corto

  // Encontrar el siguiente número libre para ese prefijo
  const existentes = productos
    .map(p => p.sku || '')
    .filter(s => s.startsWith(letras))
    .map(s => parseInt(s.slice(3), 10))
    .filter(n => !isNaN(n));

  let siguiente = 1;
  if (existentes.length > 0) {
    siguiente = Math.max(...existentes) + 1;
  }

  // Si supera 999, buscar primer hueco libre
  if (siguiente > 999) {
    for (let i = 1; i <= 999; i++) {
      if (!existentes.includes(i)) { siguiente = i; break; }
    }
  }

  return letras + String(siguiente).padStart(3, '0');
}
