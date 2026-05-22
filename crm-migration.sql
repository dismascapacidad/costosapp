-- CRM Migration — CostosApp
-- Ejecutar una sola vez en el dashboard de Supabase (SQL Editor).
-- Crea las tablas contactos_crm, casos_crm e interacciones_crm con RLS por user_id.

-- ── Función para actualizar updated_at automáticamente ────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Tabla: contactos_crm ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contactos_crm (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('profesional', 'institucion', 'aliado', 'familia')),
  telefono    TEXT        NOT NULL DEFAULT '',
  email       TEXT,
  origen      TEXT        NOT NULL CHECK (origen IN ('landing_epe', 'tienda', 'referido', 'red_social', 'otro')),
  notas       TEXT        NOT NULL DEFAULT '',
  cliente_id  TEXT,       -- referencia opcional a clientes existentes (sin FK para no acoplar esquemas)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_contactos_crm_updated_at
  BEFORE UPDATE ON contactos_crm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contactos_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contactos_crm: acceso propio"
  ON contactos_crm FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Tabla: casos_crm ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casos_crm (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contacto_id           UUID        NOT NULL REFERENCES contactos_crm(id) ON DELETE CASCADE,
  producto_interes      TEXT        NOT NULL DEFAULT '',  -- texto libre, puede ser nombre de producto del catálogo
  estado                TEXT        NOT NULL DEFAULT 'nuevo'
                                    CHECK (estado IN ('nuevo', 'en_conversacion', 'propuesta_enviada', 'convertido', 'sin_respuesta')),
  fecha_primer_contacto DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proxima_accion        TEXT        NOT NULL DEFAULT '',
  fecha_proxima_accion  DATE,
  valor_estimado        NUMERIC,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_casos_crm_updated_at
  BEFORE UPDATE ON casos_crm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE casos_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casos_crm: acceso propio"
  ON casos_crm FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Tabla: interacciones_crm ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interacciones_crm (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caso_id      UUID        NOT NULL REFERENCES casos_crm(id) ON DELETE CASCADE,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canal        TEXT        NOT NULL CHECK (canal IN ('whatsapp', 'email', 'telefono', 'presencial', 'otro')),
  resumen      TEXT        NOT NULL,
  proximo_paso TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interacciones_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interacciones_crm: acceso propio"
  ON interacciones_crm FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Índices para performance ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contactos_crm_user    ON contactos_crm(user_id);
CREATE INDEX IF NOT EXISTS idx_casos_crm_user         ON casos_crm(user_id);
CREATE INDEX IF NOT EXISTS idx_casos_crm_contacto     ON casos_crm(contacto_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_crm_caso ON interacciones_crm(caso_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_crm_user ON interacciones_crm(user_id);
