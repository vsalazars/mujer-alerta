ALTER TABLE public.registro_institucional_solicitudes
ADD COLUMN IF NOT EXISTS institucion_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'registro_institucional_solicitudes_institucion_id_fkey'
  ) THEN
    ALTER TABLE public.registro_institucional_solicitudes
      ADD CONSTRAINT registro_institucional_solicitudes_institucion_id_fkey
      FOREIGN KEY (institucion_id)
      REFERENCES public.instituciones(id)
      ON DELETE SET NULL;
  END IF;
END $$;
