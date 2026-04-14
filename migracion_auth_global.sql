BEGIN;

CREATE OR REPLACE FUNCTION public.app_login_candidates_by_email(p_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  nombre text,
  rol text,
  password_hash text,
  activo boolean,
  institucion_id bigint,
  institucion_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    u.nombre,
    u.rol::text,
    u.password_hash,
    u.activo,
    u.institucion_id,
    i.slug
  FROM public.usuarios u
  JOIN public.instituciones i
    ON i.id = u.institucion_id
  WHERE lower(u.email) = lower(trim(p_email))
  ORDER BY u.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.app_login_candidates_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login_candidates_by_email(text) TO PUBLIC;

COMMIT;
