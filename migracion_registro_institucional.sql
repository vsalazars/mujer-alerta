CREATE TABLE IF NOT EXISTS public.registro_institucional_solicitudes (
    id bigserial PRIMARY KEY,
    institucion_nombre text NOT NULL,
    tipo text NOT NULL DEFAULT 'institucion',
    nombre_contacto text NOT NULL,
    cargo_contacto text,
    email_contacto text NOT NULL,
    telefono_contacto text,
    estado text,
    ciudad text,
    sitio_web text,
    slug_deseado text,
    estatus text NOT NULL DEFAULT 'pendiente',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT registro_institucional_tipo_check
      CHECK (tipo IN ('universidad', 'empresa', 'institucion')),
    CONSTRAINT registro_institucional_estatus_check
      CHECK (estatus IN ('pendiente', 'contactado', 'aprobado', 'rechazado')),
    CONSTRAINT registro_institucional_email_check
      CHECK (position('@' in email_contacto) > 1),
    CONSTRAINT registro_institucional_slug_check
      CHECK (
        slug_deseado IS NULL
        OR slug_deseado ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
);

CREATE INDEX IF NOT EXISTS idx_registro_institucional_solicitudes_email
    ON public.registro_institucional_solicitudes (lower(email_contacto));

CREATE INDEX IF NOT EXISTS idx_registro_institucional_solicitudes_slug
    ON public.registro_institucional_solicitudes (lower(slug_deseado))
    WHERE slug_deseado IS NOT NULL;

DROP TRIGGER IF EXISTS trg_set_updated_at_registro_institucional_solicitudes
    ON public.registro_institucional_solicitudes;

CREATE TRIGGER trg_set_updated_at_registro_institucional_solicitudes
BEFORE UPDATE ON public.registro_institucional_solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
