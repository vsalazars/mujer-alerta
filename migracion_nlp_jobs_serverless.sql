BEGIN;

CREATE TABLE IF NOT EXISTS public.nlp_jobs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_key             text NOT NULL,
    institucion_id      bigint NOT NULL,
    centro_ids          bigint[] NOT NULL,
    year                integer,
    limit_value         integer,
    encuesta_id         uuid,
    dry_run             boolean NOT NULL DEFAULT false,

    status              text NOT NULL DEFAULT 'queued',
    running             boolean NOT NULL DEFAULT false,

    current_value       integer NOT NULL DEFAULT 0,
    total_value         integer NOT NULL DEFAULT 0,
    processed_value     integer NOT NULL DEFAULT 0,
    errors_value        integer NOT NULL DEFAULT 0,

    last_encuesta_id    uuid,
    last_event          text,
    last_error          text,

    cloud_execution     text,
    requested_by        uuid,

    started_at          timestamptz,
    finished_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT nlp_jobs_status_check
        CHECK (
            status IN (
                'queued',
                'starting',
                'running',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT nlp_jobs_current_check
        CHECK (current_value >= 0),

    CONSTRAINT nlp_jobs_total_check
        CHECK (total_value >= 0),

    CONSTRAINT nlp_jobs_processed_check
        CHECK (processed_value >= 0),

    CONSTRAINT nlp_jobs_errors_check
        CHECK (errors_value >= 0),

    CONSTRAINT nlp_jobs_limit_check
        CHECK (limit_value IS NULL OR limit_value > 0),

    CONSTRAINT nlp_jobs_year_check
        CHECK (year IS NULL OR year BETWEEN 2000 AND 2100),

    CONSTRAINT nlp_jobs_centros_check
        CHECK (cardinality(centro_ids) > 0),

    CONSTRAINT nlp_jobs_institucion_fkey
        FOREIGN KEY (institucion_id)
        REFERENCES public.instituciones(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nlp_jobs_institucion_created
    ON public.nlp_jobs (institucion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nlp_jobs_status
    ON public.nlp_jobs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nlp_jobs_job_key
    ON public.nlp_jobs (job_key, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nlp_jobs_active_key
    ON public.nlp_jobs (job_key)
    WHERE running = true;

CREATE OR REPLACE FUNCTION public.set_nlp_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_nlp_jobs
    ON public.nlp_jobs;

CREATE TRIGGER trg_set_updated_at_nlp_jobs
BEFORE UPDATE ON public.nlp_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_nlp_jobs_updated_at();

COMMENT ON TABLE public.nlp_jobs IS
    'Estado persistente de ejecuciones del procesamiento NLP, compatible con Cloud Run Jobs.';

COMMENT ON COLUMN public.nlp_jobs.job_key IS
    'Clave lógica formada por institución, centros y periodo para impedir ejecuciones activas duplicadas.';

COMMENT ON COLUMN public.nlp_jobs.cloud_execution IS
    'Nombre completo de la ejecución correspondiente en Cloud Run Jobs.';

COMMIT;
