CREATE TABLE IF NOT EXISTS public.respuestas_iniciales (
  id BIGSERIAL PRIMARY KEY,
  encuesta_id uuid NOT NULL,
  institucion_id bigint NOT NULL,
  pregunta_id text NOT NULL,
  opcion_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT respuestas_iniciales_encuesta_id_pregunta_id_key
    UNIQUE (encuesta_id, pregunta_id),

  CONSTRAINT respuestas_iniciales_pregunta_id_check
    CHECK (pregunta_id ~ '^I[1-4]$'::text),

  CONSTRAINT respuestas_iniciales_opcion_id_check
    CHECK (opcion_id ~ '^I[1-4]_O([1-9])$'::text),

  CONSTRAINT respuestas_iniciales_encuesta_institucion_fkey
    FOREIGN KEY (encuesta_id, institucion_id)
    REFERENCES public.encuestas(id, institucion_id)
    ON DELETE CASCADE,

  CONSTRAINT respuestas_iniciales_institucion_id_fkey
    FOREIGN KEY (institucion_id)
    REFERENCES public.instituciones(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_respuestas_iniciales_encuesta
  ON public.respuestas_iniciales (encuesta_id);

CREATE INDEX IF NOT EXISTS idx_respuestas_iniciales_institucion
  ON public.respuestas_iniciales (institucion_id);

CREATE INDEX IF NOT EXISTS idx_respuestas_iniciales_pregunta_opcion
  ON public.respuestas_iniciales (pregunta_id, opcion_id);

DROP TRIGGER IF EXISTS trg_set_updated_at_respuestas_iniciales ON public.respuestas_iniciales;
CREATE TRIGGER trg_set_updated_at_respuestas_iniciales
BEFORE UPDATE ON public.respuestas_iniciales
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.respuestas_iniciales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_respuestas_iniciales_tenant ON public.respuestas_iniciales;
CREATE POLICY p_respuestas_iniciales_tenant
ON public.respuestas_iniciales
USING (
  public.app_current_is_super_admin()
  OR institucion_id = public.app_current_institucion_id()
)
WITH CHECK (
  public.app_current_is_super_admin()
  OR institucion_id = public.app_current_institucion_id()
);
