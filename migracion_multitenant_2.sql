BEGIN;

CREATE TABLE IF NOT EXISTS public.instituciones (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'universidad',
  email_contacto TEXT,
  telefono TEXT,
  pais TEXT DEFAULT 'México',
  estado TEXT,
  ciudad TEXT,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  estatus_validacion public.estatus_institucion_enum NOT NULL DEFAULT 'pendiente',
  owner_user_id UUID,
  validado_at TIMESTAMPTZ,
  validado_por UUID,
  observaciones_validacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instituciones_slug_key UNIQUE (slug),
  CONSTRAINT instituciones_tipo_check CHECK (
    tipo IN ('universidad', 'empresa', 'institucion')
  )
);

CREATE INDEX IF NOT EXISTS idx_instituciones_estatus
  ON public.instituciones (estatus_validacion);

CREATE INDEX IF NOT EXISTS idx_instituciones_activo
  ON public.instituciones (activo);

CREATE TABLE IF NOT EXISTS public.configuracion_institucion (
  institucion_id BIGINT PRIMARY KEY,
  nombre_publico TEXT,
  logo_url TEXT,
  color_primario TEXT,
  color_secundario TEXT,
  dominio_permitido TEXT,
  permite_autoregistro BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_correo_institucional BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT configuracion_institucion_fk
    FOREIGN KEY (institucion_id)
    REFERENCES public.instituciones(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.auditoria (
  id BIGSERIAL PRIMARY KEY,
  institucion_id BIGINT,
  usuario_id UUID,
  accion public.accion_auditoria_enum NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT,
  detalle_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auditoria_institucion_fk
    FOREIGN KEY (institucion_id)
    REFERENCES public.instituciones(id)
    ON DELETE SET NULL,
  CONSTRAINT auditoria_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auditoria_institucion_created
  ON public.auditoria (institucion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_created
  ON public.auditoria (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
  ON public.auditoria (entidad, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER TABLE public.centros
  ADD COLUMN IF NOT EXISTS institucion_id BIGINT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS institucion_id BIGINT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.encuestas
  ADD COLUMN IF NOT EXISTS institucion_id BIGINT;

ALTER TABLE public.comentario_analisis
  ADD COLUMN IF NOT EXISTS institucion_id BIGINT;

ALTER TABLE public.usuario_centros
  ADD COLUMN IF NOT EXISTS institucion_id BIGINT;

INSERT INTO public.instituciones (
  nombre,
  slug,
  tipo,
  activo,
  estatus_validacion,
  observaciones_validacion
)
SELECT
  'Institución Demo Inicial',
  'institucion-demo-inicial',
  'universidad',
  TRUE,
  'activa',
  'Registro creado automáticamente durante migración multitenant'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.instituciones
  WHERE slug = 'institucion-demo-inicial'
);

UPDATE public.centros
SET institucion_id = i.id
FROM public.instituciones i
WHERE i.slug = 'institucion-demo-inicial'
  AND public.centros.institucion_id IS NULL;

UPDATE public.usuarios
SET institucion_id = i.id
FROM public.instituciones i
WHERE i.slug = 'institucion-demo-inicial'
  AND public.usuarios.institucion_id IS NULL;

UPDATE public.encuestas e
SET institucion_id = c.institucion_id
FROM public.centros c
WHERE e.centro_id = c.id
  AND e.institucion_id IS NULL;

UPDATE public.comentario_analisis ca
SET institucion_id = e.institucion_id
FROM public.encuestas e
WHERE ca.encuesta_id = e.id
  AND ca.institucion_id IS NULL;

UPDATE public.usuario_centros uc
SET institucion_id = c.institucion_id
FROM public.centros c
WHERE uc.centro_id = c.id
  AND uc.institucion_id IS NULL;

ALTER TABLE public.centros
  ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE public.usuarios
  ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE public.encuestas
  ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE public.comentario_analisis
  ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE public.usuario_centros
  ALTER COLUMN institucion_id SET NOT NULL;

ALTER TABLE public.centros
  ADD CONSTRAINT centros_institucion_id_fkey
  FOREIGN KEY (institucion_id)
  REFERENCES public.instituciones(id)
  ON DELETE RESTRICT;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_institucion_id_fkey
  FOREIGN KEY (institucion_id)
  REFERENCES public.instituciones(id)
  ON DELETE RESTRICT;

ALTER TABLE public.encuestas
  ADD CONSTRAINT encuestas_institucion_id_fkey
  FOREIGN KEY (institucion_id)
  REFERENCES public.instituciones(id)
  ON DELETE RESTRICT;

ALTER TABLE public.comentario_analisis
  ADD CONSTRAINT comentario_analisis_institucion_id_fkey
  FOREIGN KEY (institucion_id)
  REFERENCES public.instituciones(id)
  ON DELETE RESTRICT;

ALTER TABLE public.usuario_centros
  ADD CONSTRAINT usuario_centros_institucion_id_fkey
  FOREIGN KEY (institucion_id)
  REFERENCES public.instituciones(id)
  ON DELETE RESTRICT;

ALTER TABLE public.instituciones
  ADD CONSTRAINT instituciones_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.usuarios(id)
  ON DELETE SET NULL;

ALTER TABLE public.instituciones
  ADD CONSTRAINT instituciones_validado_por_fkey
  FOREIGN KEY (validado_por)
  REFERENCES public.usuarios(id)
  ON DELETE SET NULL;

WITH candidato AS (
  SELECT u.id, u.institucion_id
  FROM public.usuarios u
  WHERE u.rol = 'admin'
  ORDER BY u.created_at
  LIMIT 1
)
UPDATE public.usuarios u
SET rol = 'owner_institucion'
FROM candidato c
WHERE u.id = c.id;

WITH candidato AS (
  SELECT u.id, u.institucion_id
  FROM public.usuarios u
  WHERE u.rol = 'owner_institucion'
  ORDER BY u.created_at
  LIMIT 1
)
UPDATE public.instituciones i
SET owner_user_id = c.id
FROM candidato c
WHERE i.id = c.institucion_id
  AND i.owner_user_id IS NULL;

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_email_key;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_institucion_email_key
  UNIQUE (institucion_id, email);

CREATE INDEX IF NOT EXISTS idx_centros_institucion
  ON public.centros (institucion_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_institucion
  ON public.usuarios (institucion_id);

CREATE INDEX IF NOT EXISTS idx_encuestas_institucion
  ON public.encuestas (institucion_id);

CREATE INDEX IF NOT EXISTS idx_encuestas_institucion_centro
  ON public.encuestas (institucion_id, centro_id);

CREATE INDEX IF NOT EXISTS idx_encuestas_institucion_created
  ON public.encuestas (institucion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comentario_analisis_institucion
  ON public.comentario_analisis (institucion_id);

CREATE INDEX IF NOT EXISTS idx_usuario_centros_institucion
  ON public.usuario_centros (institucion_id);

CREATE OR REPLACE FUNCTION public.validar_encuesta_mismo_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_institucion_centro BIGINT;
BEGIN
  SELECT c.institucion_id
  INTO v_institucion_centro
  FROM public.centros c
  WHERE c.id = NEW.centro_id;

  IF v_institucion_centro IS NULL THEN
    RAISE EXCEPTION 'Centro % no existe o no tiene institución', NEW.centro_id;
  END IF;

  IF NEW.institucion_id IS DISTINCT FROM v_institucion_centro THEN
    RAISE EXCEPTION
      'La encuesta tiene institucion_id % pero el centro % pertenece a institucion_id %',
      NEW.institucion_id, NEW.centro_id, v_institucion_centro;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_encuesta_mismo_tenant ON public.encuestas;

CREATE TRIGGER trg_validar_encuesta_mismo_tenant
BEFORE INSERT OR UPDATE ON public.encuestas
FOR EACH ROW
EXECUTE FUNCTION public.validar_encuesta_mismo_tenant();

CREATE OR REPLACE FUNCTION public.validar_usuario_centro_mismo_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_institucion_usuario BIGINT;
  v_institucion_centro BIGINT;
BEGIN
  SELECT u.institucion_id
  INTO v_institucion_usuario
  FROM public.usuarios u
  WHERE u.id = NEW.usuario_id;

  SELECT c.institucion_id
  INTO v_institucion_centro
  FROM public.centros c
  WHERE c.id = NEW.centro_id;

  IF v_institucion_usuario IS NULL OR v_institucion_centro IS NULL THEN
    RAISE EXCEPTION 'Usuario o centro inexistente para usuario_centros';
  END IF;

  IF NEW.institucion_id IS DISTINCT FROM v_institucion_usuario
     OR NEW.institucion_id IS DISTINCT FROM v_institucion_centro THEN
    RAISE EXCEPTION
      'usuario_centros inconsistente: usuario %, centro %, institucion_id %',
      NEW.usuario_id, NEW.centro_id, NEW.institucion_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_usuario_centro_mismo_tenant ON public.usuario_centros;

CREATE TRIGGER trg_validar_usuario_centro_mismo_tenant
BEFORE INSERT OR UPDATE ON public.usuario_centros
FOR EACH ROW
EXECUTE FUNCTION public.validar_usuario_centro_mismo_tenant();

DROP TRIGGER IF EXISTS trg_set_updated_at_instituciones ON public.instituciones;
CREATE TRIGGER trg_set_updated_at_instituciones
BEFORE UPDATE ON public.instituciones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_configuracion_institucion ON public.configuracion_institucion;
CREATE TRIGGER trg_set_updated_at_configuracion_institucion
BEFORE UPDATE ON public.configuracion_institucion
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_centros ON public.centros;
CREATE TRIGGER trg_set_updated_at_centros
BEFORE UPDATE ON public.centros
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_usuarios ON public.usuarios;
CREATE TRIGGER trg_set_updated_at_usuarios
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_comentario_analisis ON public.comentario_analisis;
CREATE TRIGGER trg_set_updated_at_comentario_analisis
BEFORE UPDATE ON public.comentario_analisis
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.configuracion_institucion (
  institucion_id,
  nombre_publico,
  permite_autoregistro,
  requiere_correo_institucional
)
SELECT
  i.id,
  i.nombre,
  TRUE,
  FALSE
FROM public.instituciones i
WHERE i.slug = 'institucion-demo-inicial'
  AND NOT EXISTS (
    SELECT 1
    FROM public.configuracion_institucion ci
    WHERE ci.institucion_id = i.id
  );

COMMIT;
