BEGIN;

-- =========================================================
-- RESOLUCION DE TENANT POR SLUG
-- Permite resolver institucion_id a partir de slug aun con RLS activo.
-- =========================================================

DROP FUNCTION IF EXISTS public.app_resolve_institucion_id_by_slug(TEXT);

CREATE FUNCTION public.app_resolve_institucion_id_by_slug(p_slug TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug TEXT;
  v_institucion_id BIGINT;
BEGIN
  v_slug := lower(btrim(COALESCE(p_slug, '')));

  IF v_slug = '' THEN
    RETURN NULL;
  END IF;

  SELECT i.id
  INTO v_institucion_id
  FROM public.instituciones i
  WHERE lower(i.slug) = v_slug
    AND i.activo = TRUE
    AND i.estatus_validacion = 'activa'
  ORDER BY i.id
  LIMIT 1;

  RETURN v_institucion_id;
END;
$$;

COMMENT ON FUNCTION public.app_resolve_institucion_id_by_slug(TEXT)
IS 'Resuelve institucion_id desde slug para requests publicos multitenant con RLS activo.';

COMMIT;
