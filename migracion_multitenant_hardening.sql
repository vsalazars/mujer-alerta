BEGIN;

-- =========================================================
-- HARDENING MULTITENANT PARA SAAS
-- Refuerza aislamiento por tenant sin reemplazar tus migraciones previas.
-- =========================================================

-- ---------------------------------------------------------
-- 1) HELPERS DE CONTEXTO DE SESION PARA RLS
-- La app debe setear:
--   SET app.current_institucion_id = '<id>';
--   SET app.current_is_super_admin = 'true|false';
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_current_institucion_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_institucion_id', true), '')::BIGINT
$$;

CREATE OR REPLACE FUNCTION public.app_current_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_is_super_admin', true), '')::BOOLEAN, FALSE)
$$;

-- ---------------------------------------------------------
-- 2) PRECHECKS DE DATOS ANTES DE ENDURECER CONSTRAINTS
-- ---------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comentario_analisis ca
    JOIN public.encuestas e ON e.id = ca.encuesta_id
    WHERE ca.institucion_id <> e.institucion_id
  ) THEN
    RAISE EXCEPTION
      'Hay filas en comentario_analisis con institucion_id distinto al de su encuesta';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auditoria a
    JOIN public.usuarios u ON u.id = a.usuario_id
    WHERE a.institucion_id IS NOT NULL
      AND a.institucion_id <> u.institucion_id
  ) THEN
    RAISE EXCEPTION
      'Hay filas en auditoria con institucion_id distinto al del usuario asociado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.instituciones i
    JOIN public.usuarios u ON u.id = i.owner_user_id
    WHERE u.institucion_id <> i.id
  ) THEN
    RAISE EXCEPTION
      'Hay instituciones con owner_user_id apuntando a un usuario de otro tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.centros
    WHERE clave IS NOT NULL
    GROUP BY institucion_id, clave
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existen claves de centro duplicadas dentro del mismo tenant';
  END IF;
END
$$;

-- ---------------------------------------------------------
-- 3) CONSTRAINTS COMPUESTAS PARA INTEGRIDAD ENTRE TENANTS
-- ---------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_id_institucion_key'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_id_institucion_key
      UNIQUE (id, institucion_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'centros_id_institucion_key'
  ) THEN
    ALTER TABLE public.centros
      ADD CONSTRAINT centros_id_institucion_key
      UNIQUE (id, institucion_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'encuestas_id_institucion_key'
  ) THEN
    ALTER TABLE public.encuestas
      ADD CONSTRAINT encuestas_id_institucion_key
      UNIQUE (id, institucion_id);
  END IF;
END
$$;

ALTER TABLE public.comentario_analisis
  DROP CONSTRAINT IF EXISTS comentario_analisis_encuesta_id_fkey;

ALTER TABLE public.comentario_analisis
  DROP CONSTRAINT IF EXISTS comentario_analisis_encuesta_institucion_fkey;

ALTER TABLE public.comentario_analisis
  ADD CONSTRAINT comentario_analisis_encuesta_institucion_fkey
  FOREIGN KEY (encuesta_id, institucion_id)
  REFERENCES public.encuestas(id, institucion_id)
  ON DELETE CASCADE;

ALTER TABLE public.usuario_centros
  DROP CONSTRAINT IF EXISTS usuario_centros_usuario_id_fkey;

ALTER TABLE public.usuario_centros
  DROP CONSTRAINT IF EXISTS usuario_centros_centro_id_fkey;

ALTER TABLE public.usuario_centros
  DROP CONSTRAINT IF EXISTS usuario_centros_usuario_institucion_fkey;

ALTER TABLE public.usuario_centros
  DROP CONSTRAINT IF EXISTS usuario_centros_centro_institucion_fkey;

ALTER TABLE public.usuario_centros
  ADD CONSTRAINT usuario_centros_usuario_institucion_fkey
  FOREIGN KEY (usuario_id, institucion_id)
  REFERENCES public.usuarios(id, institucion_id)
  ON DELETE CASCADE;

ALTER TABLE public.usuario_centros
  ADD CONSTRAINT usuario_centros_centro_institucion_fkey
  FOREIGN KEY (centro_id, institucion_id)
  REFERENCES public.centros(id, institucion_id)
  ON DELETE RESTRICT;

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_usuario_institucion_fk;

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_usuario_fk;

ALTER TABLE public.auditoria
  ADD CONSTRAINT auditoria_usuario_fk
  FOREIGN KEY (usuario_id)
  REFERENCES public.usuarios(id)
  ON DELETE SET NULL;

-- owner_user_id debe pertenecer al mismo tenant
CREATE OR REPLACE FUNCTION public.validar_owner_institucion_mismo_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_institucion_usuario BIGINT;
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.institucion_id
  INTO v_institucion_usuario
  FROM public.usuarios u
  WHERE u.id = NEW.owner_user_id;

  IF v_institucion_usuario IS NULL THEN
    RAISE EXCEPTION 'owner_user_id % no existe', NEW.owner_user_id;
  END IF;

  IF v_institucion_usuario IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION
      'owner_user_id % pertenece a institucion_id %, no a %',
      NEW.owner_user_id, v_institucion_usuario, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_owner_institucion_mismo_tenant
ON public.instituciones;

CREATE TRIGGER trg_validar_owner_institucion_mismo_tenant
BEFORE INSERT OR UPDATE OF owner_user_id ON public.instituciones
FOR EACH ROW
EXECUTE FUNCTION public.validar_owner_institucion_mismo_tenant();

-- ---------------------------------------------------------
-- 4) UNICIDAD POR TENANT EN LUGAR DE GLOBAL
-- ---------------------------------------------------------

ALTER TABLE public.centros
  DROP CONSTRAINT IF EXISTS centros_clave_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_centros_institucion_clave
  ON public.centros (institucion_id, clave)
  WHERE clave IS NOT NULL;

-- ---------------------------------------------------------
-- 5) TRIGGERS EXTRA DE COHERENCIA MULTITENANT
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validar_comentario_analisis_mismo_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_institucion_encuesta BIGINT;
BEGIN
  SELECT e.institucion_id
  INTO v_institucion_encuesta
  FROM public.encuestas e
  WHERE e.id = NEW.encuesta_id;

  IF v_institucion_encuesta IS NULL THEN
    RAISE EXCEPTION 'Encuesta % no existe', NEW.encuesta_id;
  END IF;

  IF NEW.institucion_id IS DISTINCT FROM v_institucion_encuesta THEN
    RAISE EXCEPTION
      'comentario_analisis inconsistente: encuesta %, institucion_id %, tenant encuesta %',
      NEW.encuesta_id, NEW.institucion_id, v_institucion_encuesta;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_comentario_analisis_mismo_tenant
ON public.comentario_analisis;

CREATE TRIGGER trg_validar_comentario_analisis_mismo_tenant
BEFORE INSERT OR UPDATE ON public.comentario_analisis
FOR EACH ROW
EXECUTE FUNCTION public.validar_comentario_analisis_mismo_tenant();

CREATE OR REPLACE FUNCTION public.validar_auditoria_mismo_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_institucion_usuario BIGINT;
BEGIN
  IF NEW.usuario_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.institucion_id
  INTO v_institucion_usuario
  FROM public.usuarios u
  WHERE u.id = NEW.usuario_id;

  IF v_institucion_usuario IS NULL THEN
    RAISE EXCEPTION 'Usuario % no existe para auditoria', NEW.usuario_id;
  END IF;

  IF NEW.institucion_id IS NULL THEN
    NEW.institucion_id := v_institucion_usuario;
    RETURN NEW;
  END IF;

  IF NEW.institucion_id IS DISTINCT FROM v_institucion_usuario THEN
    RAISE EXCEPTION
      'auditoria inconsistente: usuario %, institucion_id %, tenant usuario %',
      NEW.usuario_id, NEW.institucion_id, v_institucion_usuario;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_auditoria_mismo_tenant
ON public.auditoria;

CREATE TRIGGER trg_validar_auditoria_mismo_tenant
BEFORE INSERT OR UPDATE ON public.auditoria
FOR EACH ROW
EXECUTE FUNCTION public.validar_auditoria_mismo_tenant();

-- ---------------------------------------------------------
-- 6) RLS POR TENANT
-- Super admins ven todo.
-- Usuarios normales quedan limitados por app.current_institucion_id.
-- ---------------------------------------------------------

ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_institucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_centros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentario_analisis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentario_tema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_instituciones_tenant ON public.instituciones;
CREATE POLICY p_instituciones_tenant ON public.instituciones
  USING (
    public.app_current_is_super_admin()
    OR id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_configuracion_institucion_tenant ON public.configuracion_institucion;
CREATE POLICY p_configuracion_institucion_tenant ON public.configuracion_institucion
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_usuarios_tenant ON public.usuarios;
CREATE POLICY p_usuarios_tenant ON public.usuarios
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_centros_tenant ON public.centros;
CREATE POLICY p_centros_tenant ON public.centros
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_encuestas_tenant ON public.encuestas;
CREATE POLICY p_encuestas_tenant ON public.encuestas
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_usuario_centros_tenant ON public.usuario_centros;
CREATE POLICY p_usuario_centros_tenant ON public.usuario_centros
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_comentario_analisis_tenant ON public.comentario_analisis;
CREATE POLICY p_comentario_analisis_tenant ON public.comentario_analisis
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

DROP POLICY IF EXISTS p_comentario_tema_tenant ON public.comentario_tema;
CREATE POLICY p_comentario_tema_tenant ON public.comentario_tema
  USING (
    public.app_current_is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.comentario_analisis ca
      WHERE ca.id = comentario_tema.analisis_id
        AND ca.institucion_id = public.app_current_institucion_id()
    )
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.comentario_analisis ca
      WHERE ca.id = comentario_tema.analisis_id
        AND ca.institucion_id = public.app_current_institucion_id()
    )
  );

DROP POLICY IF EXISTS p_respuestas_tenant ON public.respuestas;
CREATE POLICY p_respuestas_tenant ON public.respuestas
  USING (
    public.app_current_is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.encuestas e
      WHERE e.id = respuestas.encuesta_id
        AND e.institucion_id = public.app_current_institucion_id()
    )
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.encuestas e
      WHERE e.id = respuestas.encuesta_id
        AND e.institucion_id = public.app_current_institucion_id()
    )
  );

DROP POLICY IF EXISTS p_auditoria_tenant ON public.auditoria;
CREATE POLICY p_auditoria_tenant ON public.auditoria
  USING (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  )
  WITH CHECK (
    public.app_current_is_super_admin()
    OR institucion_id = public.app_current_institucion_id()
  );

COMMIT;
