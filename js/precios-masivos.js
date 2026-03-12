/**
 * precios-masivos.js
 * Edición masiva de precios de insumos y productos.
 * Funciones puras que previsualizan sin persistir — el llamador decide si aplica.
 *
 * Modos de ajuste:
 *   'porcentaje' — aplica N% sobre el valor actual  (puede ser negativo)
 *   'suma'       — suma/resta un monto fijo          (puede ser negativo)
 *
 * Para insumos:   modifica precioCompra (costoUnitario se recalcula)
 * Para productos: modifica margenConsumidor y/o precioDistribuidor
 */

// ── Cálculo base ──────────────────────────────────────────────────────────────

function calcularNuevoValor(valorActual, modo, valor) {
  const nuevo = modo === 'porcentaje'
    ? valorActual * (1 + valor / 100)
    : valorActual + valor;
  return Math.max(0, nuevo);
}

// ── Previsualización insumos ──────────────────────────────────────────────────

function previsualizarAjusteInsumos(insumos, modo, valor) {
  return insumos.map(ins => {
    const precioNuevo = calcularNuevoValor(ins.precioCompra, modo, valor);
    return {
      id:           ins.id,
      nombre:       ins.nombre,
      unidad:       ins.unidad,
      precioActual: ins.precioCompra,
      precioNuevo,
      delta:        precioNuevo - ins.precioCompra
    };
  });
}

// ── Previsualización productos ────────────────────────────────────────────────

/**
 * Previsualiza el ajuste sobre productos SIN persistir.
 * campo: 'margen' | 'distribuidor' | 'ambos'
 *
 * Para el margen consumidor: ajusta margenConsumidor y recalcula precioFinal.
 * Para distribuidor: si el producto tiene precioDistribuidor manual → ajusta ese precio;
 *   si usa margenDistribuidor → ajusta el margen.
 */
function previsualizarAjusteProductos(productos, modo, valor, campo, insumos) {
  return productos.map(p => {
    // ── Consumidor ──
    let margenActual  = p.margenConsumidor ?? p.margenDeseado ?? 45;
    let margenNuevo   = margenActual;
    let precioConsumidorActual = 0;
    let precioConsumidorNuevo  = 0;

    try { precioConsumidorActual = calcularPrecioSugerido(p, insumos); } catch (_) {}

    if (campo === 'margen' || campo === 'ambos') {
      margenNuevo = Math.min(99, Math.max(0, calcularNuevoValor(margenActual, modo, valor)));
      try {
        const pTemp = {
          ...p,
          modoConsumidor:   'margen',
          margenConsumidor: margenNuevo
        };
        precioConsumidorNuevo = calcularPrecioSugerido(pTemp, insumos);
      } catch (_) {}
    } else {
      precioConsumidorNuevo = precioConsumidorActual;
    }

    // ── Distribuidor ──
    let precioDistribActual = p.precioDistribuidor || 0;
    let precioDistribNuevo  = precioDistribActual;

    if (campo === 'distribuidor' || campo === 'ambos') {
      if (p.modoDistribuidor === 'precio' && precioDistribActual > 0) {
        // Tiene precio manual → ajustar precio
        precioDistribNuevo = calcularNuevoValor(precioDistribActual, modo, valor);
      } else {
        // Usa margen → ajustar margenDistribuidor y recalcular precio
        const mdActual = p.margenDistribuidor ?? 20;
        const mdNuevo  = Math.min(99, Math.max(0, calcularNuevoValor(mdActual, modo, valor)));
        const pFinal   = campo === 'ambos' ? precioConsumidorNuevo : precioConsumidorActual;
        precioDistribActual = pFinal > 0 ? pFinal * (1 - mdActual / 100) : 0;
        precioDistribNuevo  = pFinal > 0 ? pFinal * (1 - mdNuevo  / 100) : 0;
      }
    }

    return {
      id:   p.id,
      nombre: p.nombre,
      sku:  p.sku || '—',
      margenActual,
      margenNuevo,
      precioConsumidorActual,
      precioConsumidorNuevo,
      precioDistribActual,
      precioDistribNuevo
    };
  });
}

// ── Aplicación a insumos (modifica AppData y persiste) ────────────────────────

function aplicarAjusteInsumos(ids, modo, valor) {
  ids.forEach(id => {
    const ins = window.AppData.insumos.find(i => i.id === id);
    if (!ins) return;
    ins.precioCompra = calcularNuevoValor(ins.precioCompra, modo, valor);
    ins.costoUnitario = calcularCostoUnitario(
      ins.precioCompra, ins.cantidadCompra, ins.moneda, window.AppData.tipoCambioManual
    );
    ins.fechaActualizacion = new Date().toISOString();
  });
  saveData(window.AppData);
}

// ── Aplicación a productos (modifica AppData y persiste) ─────────────────────

function aplicarAjusteProductos(ids, modo, valor, campo) {
  ids.forEach(id => {
    const p = window.AppData.productos.find(x => x.id === id);
    if (!p) return;

    if (campo === 'margen' || campo === 'ambos') {
      const mc = p.margenConsumidor ?? p.margenDeseado ?? 45;
      p.margenConsumidor = Math.min(99, Math.max(0, calcularNuevoValor(mc, modo, valor)));
      p.modoConsumidor   = 'margen';
      p.margenDeseado    = p.margenConsumidor; // retrocompat
    }

    if (campo === 'distribuidor' || campo === 'ambos') {
      if (p.modoDistribuidor === 'precio' && p.precioDistribuidor > 0) {
        p.precioDistribuidor = calcularNuevoValor(p.precioDistribuidor, modo, valor);
      } else {
        const md = p.margenDistribuidor ?? 20;
        p.margenDistribuidor = Math.min(99, Math.max(0, calcularNuevoValor(md, modo, valor)));
        p.modoDistribuidor   = 'margen';
      }
    }

    p.fechaActualizacion = new Date().toISOString();
  });
  saveData(window.AppData);
}
