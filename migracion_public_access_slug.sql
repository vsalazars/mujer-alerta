BEGIN;

DROP FUNCTION IF EXISTS public.app_resolve_public_access_slug(TEXT);

CREATE FUNCTION public.app_resolve_public_access_slug(p_slug TEXT)
RETURNS TABLE (
  kind TEXT,
  institucion_id BIGINT,
  institucion_slug TEXT,
  centro_id BIGINT,
  centro_slug TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_center_matches INTEGER;
BEGIN
  v_slug := lower(btrim(COALESCE(p_slug, '')));

  IF v_slug = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'institucion'::TEXT,
    i.id,
    i.slug,
    NULL::BIGINT,
    NULL::TEXT
  FROM public.instituciones i
  WHERE lower(i.slug) = v_slug
    AND i.activo = TRUE
    AND i.estatus_validacion = 'activa'
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_center_matches
  FROM public.centros c
  JOIN public.instituciones i ON i.id = c.institucion_id
  WHERE lower(c.slug) = v_slug
    AND c.activo = TRUE
    AND i.activo = TRUE
    AND i.estatus_validacion = 'activa';

  IF v_center_matches = 1 THEN
    RETURN QUERY
    SELECT
      'centro'::TEXT,
      i.id,
      i.slug,
      c.id,
      c.slug
    FROM public.centros c
    JOIN public.instituciones i ON i.id = c.institucion_id
    WHERE lower(c.slug) = v_slug
      AND c.activo = TRUE
      AND i.activo = TRUE
      AND i.estatus_validacion = 'activa'
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.app_resolve_public_access_slug(TEXT)
IS 'Resuelve un slug publico a una institucion activa o a un centro activo para redireccionar la entrada a la encuesta.';

REVOKE ALL ON FUNCTION public.app_resolve_public_access_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_resolve_public_access_slug(TEXT) TO PUBLIC;

COMMIT;
