BEGIN;

CREATE OR REPLACE FUNCTION public.app_slugify_text(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := lower(coalesce(p_value, ''));
  v_slug := translate(
    v_slug,
    'áàäâãéèëêíìïîóòöôõúùüûñç',
    'aaaaaeeeeiiiiooooouuuunc'
  );
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  IF v_slug = '' THEN
    v_slug := 'centro';
  END IF;

  RETURN left(v_slug, 80);
END;
$$;

ALTER TABLE public.centros
  ADD COLUMN IF NOT EXISTS slug text;

WITH base AS (
  SELECT
    id,
    institucion_id,
    public.app_slugify_text(nombre) AS base_slug,
    row_number() OVER (
      PARTITION BY institucion_id, public.app_slugify_text(nombre)
      ORDER BY id
    ) AS rn
  FROM public.centros
),
resolved AS (
  SELECT
    id,
    CASE
      WHEN rn = 1 THEN base_slug
      ELSE left(base_slug, 70) || '-' || rn::text
    END AS final_slug
  FROM base
)
UPDATE public.centros c
SET slug = r.final_slug
FROM resolved r
WHERE c.id = r.id
  AND (c.slug IS NULL OR btrim(c.slug) = '');

ALTER TABLE public.centros
  ALTER COLUMN slug SET NOT NULL;

DROP INDEX IF EXISTS public.uq_centros_institucion_slug;

CREATE UNIQUE INDEX uq_centros_institucion_slug
  ON public.centros (institucion_id, slug);

COMMIT;
