--
-- PostgreSQL database dump
--

\restrict 1IygOhrU1dAgo1O0r1BmwCKm9w8XrHkkgW27V7gaOO00Ma6xNYLrczehPd7bZBl

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS p_usuarios_tenant ON public.usuarios;
DROP POLICY IF EXISTS p_usuario_centros_tenant ON public.usuario_centros;
DROP POLICY IF EXISTS p_respuestas_tenant ON public.respuestas;
DROP POLICY IF EXISTS p_instituciones_tenant ON public.instituciones;
DROP POLICY IF EXISTS p_encuestas_tenant ON public.encuestas;
DROP POLICY IF EXISTS p_configuracion_institucion_tenant ON public.configuracion_institucion;
DROP POLICY IF EXISTS p_comentario_tema_tenant ON public.comentario_tema;
DROP POLICY IF EXISTS p_comentario_analisis_tenant ON public.comentario_analisis;
DROP POLICY IF EXISTS p_centros_tenant ON public.centros;
DROP POLICY IF EXISTS p_auditoria_tenant ON public.auditoria;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_centros DROP CONSTRAINT IF EXISTS usuario_centros_usuario_institucion_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_centros DROP CONSTRAINT IF EXISTS usuario_centros_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_centros DROP CONSTRAINT IF EXISTS usuario_centros_centro_institucion_fkey;
ALTER TABLE IF EXISTS ONLY public.respuestas DROP CONSTRAINT IF EXISTS respuestas_encuesta_id_fkey;
ALTER TABLE IF EXISTS ONLY public.registro_institucional_solicitudes DROP CONSTRAINT IF EXISTS registro_institucional_solicitudes_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.instituciones DROP CONSTRAINT IF EXISTS instituciones_validado_por_fkey;
ALTER TABLE IF EXISTS ONLY public.instituciones DROP CONSTRAINT IF EXISTS instituciones_owner_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.encuestas DROP CONSTRAINT IF EXISTS encuestas_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.encuestas DROP CONSTRAINT IF EXISTS encuestas_genero_id_fkey;
ALTER TABLE IF EXISTS ONLY public.encuestas DROP CONSTRAINT IF EXISTS encuestas_centro_id_fkey;
ALTER TABLE IF EXISTS ONLY public.configuracion_institucion DROP CONSTRAINT IF EXISTS configuracion_institucion_fk;
ALTER TABLE IF EXISTS ONLY public.comentario_tema DROP CONSTRAINT IF EXISTS comentario_tema_analisis_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comentario_analisis DROP CONSTRAINT IF EXISTS comentario_analisis_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comentario_analisis DROP CONSTRAINT IF EXISTS comentario_analisis_encuesta_institucion_fkey;
ALTER TABLE IF EXISTS ONLY public.centros DROP CONSTRAINT IF EXISTS centros_institucion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.auditoria DROP CONSTRAINT IF EXISTS auditoria_usuario_fk;
ALTER TABLE IF EXISTS ONLY public.auditoria DROP CONSTRAINT IF EXISTS auditoria_institucion_fk;
DROP TRIGGER IF EXISTS trg_validar_usuario_centro_mismo_tenant ON public.usuario_centros;
DROP TRIGGER IF EXISTS trg_validar_owner_institucion_mismo_tenant ON public.instituciones;
DROP TRIGGER IF EXISTS trg_validar_encuesta_mismo_tenant ON public.encuestas;
DROP TRIGGER IF EXISTS trg_validar_comentario_analisis_mismo_tenant ON public.comentario_analisis;
DROP TRIGGER IF EXISTS trg_validar_auditoria_mismo_tenant ON public.auditoria;
DROP TRIGGER IF EXISTS trg_set_updated_at_usuarios ON public.usuarios;
DROP TRIGGER IF EXISTS trg_set_updated_at_registro_institucional_solicitudes ON public.registro_institucional_solicitudes;
DROP TRIGGER IF EXISTS trg_set_updated_at_instituciones ON public.instituciones;
DROP TRIGGER IF EXISTS trg_set_updated_at_configuracion_institucion ON public.configuracion_institucion;
DROP TRIGGER IF EXISTS trg_set_updated_at_comentario_analisis ON public.comentario_analisis;
DROP TRIGGER IF EXISTS trg_set_updated_at_centros ON public.centros;
DROP INDEX IF EXISTS public.uq_un_owner_por_institucion;
DROP INDEX IF EXISTS public.uq_centros_institucion_slug;
DROP INDEX IF EXISTS public.uq_centros_institucion_clave;
DROP INDEX IF EXISTS public.idx_usuarios_institucion;
DROP INDEX IF EXISTS public.idx_usuario_centros_institucion;
DROP INDEX IF EXISTS public.idx_usuario_centros_centro_id;
DROP INDEX IF EXISTS public.idx_respuestas_preg_dim;
DROP INDEX IF EXISTS public.idx_respuestas_encuesta;
DROP INDEX IF EXISTS public.idx_registro_institucional_solicitudes_slug;
DROP INDEX IF EXISTS public.idx_registro_institucional_solicitudes_email;
DROP INDEX IF EXISTS public.idx_instituciones_estatus;
DROP INDEX IF EXISTS public.idx_instituciones_activo;
DROP INDEX IF EXISTS public.idx_encuestas_instrumento;
DROP INDEX IF EXISTS public.idx_encuestas_institucion_created;
DROP INDEX IF EXISTS public.idx_encuestas_institucion_centro;
DROP INDEX IF EXISTS public.idx_encuestas_institucion;
DROP INDEX IF EXISTS public.idx_encuestas_email_hash;
DROP INDEX IF EXISTS public.idx_encuestas_centro;
DROP INDEX IF EXISTS public.idx_comentario_tema_tema_clave;
DROP INDEX IF EXISTS public.idx_comentario_tema_analisis_rank;
DROP INDEX IF EXISTS public.idx_comentario_analisis_institucion;
DROP INDEX IF EXISTS public.idx_comentario_analisis_estado;
DROP INDEX IF EXISTS public.idx_comentario_analisis_emocion_label;
DROP INDEX IF EXISTS public.idx_comentario_analisis_analizado_at;
DROP INDEX IF EXISTS public.idx_centros_tipo;
DROP INDEX IF EXISTS public.idx_centros_nombre;
DROP INDEX IF EXISTS public.idx_centros_institucion;
DROP INDEX IF EXISTS public.idx_auditoria_usuario_created;
DROP INDEX IF EXISTS public.idx_auditoria_institucion_created;
DROP INDEX IF EXISTS public.idx_auditoria_entidad;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_pkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_institucion_email_key;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_id_institucion_key;
ALTER TABLE IF EXISTS ONLY public.usuario_centros DROP CONSTRAINT IF EXISTS usuario_centros_pkey;
ALTER TABLE IF EXISTS ONLY public.respuestas DROP CONSTRAINT IF EXISTS respuestas_pkey;
ALTER TABLE IF EXISTS ONLY public.respuestas DROP CONSTRAINT IF EXISTS respuestas_encuesta_id_pregunta_id_dimension_key;
ALTER TABLE IF EXISTS ONLY public.registro_institucional_solicitudes DROP CONSTRAINT IF EXISTS registro_institucional_solicitudes_pkey;
ALTER TABLE IF EXISTS ONLY public.instituciones DROP CONSTRAINT IF EXISTS instituciones_slug_key;
ALTER TABLE IF EXISTS ONLY public.instituciones DROP CONSTRAINT IF EXISTS instituciones_pkey;
ALTER TABLE IF EXISTS ONLY public.generos DROP CONSTRAINT IF EXISTS generos_pkey;
ALTER TABLE IF EXISTS ONLY public.generos DROP CONSTRAINT IF EXISTS generos_clave_key;
ALTER TABLE IF EXISTS ONLY public.encuestas DROP CONSTRAINT IF EXISTS encuestas_pkey;
ALTER TABLE IF EXISTS ONLY public.encuestas DROP CONSTRAINT IF EXISTS encuestas_id_institucion_key;
ALTER TABLE IF EXISTS ONLY public.configuracion_institucion DROP CONSTRAINT IF EXISTS configuracion_institucion_pkey;
ALTER TABLE IF EXISTS ONLY public.comentario_tema DROP CONSTRAINT IF EXISTS comentario_tema_unique;
ALTER TABLE IF EXISTS ONLY public.comentario_tema DROP CONSTRAINT IF EXISTS comentario_tema_pkey;
ALTER TABLE IF EXISTS ONLY public.comentario_analisis DROP CONSTRAINT IF EXISTS comentario_analisis_pkey;
ALTER TABLE IF EXISTS ONLY public.comentario_analisis DROP CONSTRAINT IF EXISTS comentario_analisis_encuesta_id_key;
ALTER TABLE IF EXISTS ONLY public.centros DROP CONSTRAINT IF EXISTS centros_pkey;
ALTER TABLE IF EXISTS ONLY public.centros DROP CONSTRAINT IF EXISTS centros_id_institucion_key;
ALTER TABLE IF EXISTS ONLY public.auditoria DROP CONSTRAINT IF EXISTS auditoria_pkey;
ALTER TABLE IF EXISTS public.respuestas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.registro_institucional_solicitudes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.instituciones ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.generos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.comentario_tema ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.comentario_analisis ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.centros ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.auditoria ALTER COLUMN id DROP DEFAULT;
DROP VIEW IF EXISTS public.v_matriz_tipo_dimension;
DROP VIEW IF EXISTS public.v_encuestas_conteo_respuestas;
DROP VIEW IF EXISTS public.v_comentarios_pendientes_nlp;
DROP VIEW IF EXISTS public.v_comentario_analisis_resumen;
DROP TABLE IF EXISTS public.usuarios;
DROP TABLE IF EXISTS public.usuario_centros;
DROP SEQUENCE IF EXISTS public.respuestas_id_seq;
DROP TABLE IF EXISTS public.respuestas;
DROP SEQUENCE IF EXISTS public.registro_institucional_solicitudes_id_seq;
DROP TABLE IF EXISTS public.registro_institucional_solicitudes;
DROP SEQUENCE IF EXISTS public.instituciones_id_seq;
DROP TABLE IF EXISTS public.instituciones;
DROP SEQUENCE IF EXISTS public.generos_id_seq;
DROP TABLE IF EXISTS public.generos;
DROP TABLE IF EXISTS public.encuestas;
DROP TABLE IF EXISTS public.configuracion_institucion;
DROP SEQUENCE IF EXISTS public.comentario_tema_id_seq;
DROP TABLE IF EXISTS public.comentario_tema;
DROP SEQUENCE IF EXISTS public.comentario_analisis_id_seq;
DROP TABLE IF EXISTS public.comentario_analisis;
DROP SEQUENCE IF EXISTS public.centros_id_seq;
DROP TABLE IF EXISTS public.centros;
DROP SEQUENCE IF EXISTS public.auditoria_id_seq;
DROP TABLE IF EXISTS public.auditoria;
DROP FUNCTION IF EXISTS public.validar_usuario_centro_mismo_tenant();
DROP FUNCTION IF EXISTS public.validar_owner_institucion_mismo_tenant();
DROP FUNCTION IF EXISTS public.validar_encuesta_mismo_tenant();
DROP FUNCTION IF EXISTS public.validar_comentario_analisis_mismo_tenant();
DROP FUNCTION IF EXISTS public.validar_auditoria_mismo_tenant();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.app_slugify_text(p_value text);
DROP FUNCTION IF EXISTS public.app_resolve_public_access_slug(p_slug text);
DROP FUNCTION IF EXISTS public.app_resolve_institucion_id_by_slug(p_slug text);
DROP FUNCTION IF EXISTS public.app_login_candidates_by_email(p_email text);
DROP FUNCTION IF EXISTS public.app_current_is_super_admin();
DROP FUNCTION IF EXISTS public.app_current_institucion_id();
DROP TYPE IF EXISTS public.rol_usuario_enum;
DROP TYPE IF EXISTS public.estatus_institucion_enum;
DROP TYPE IF EXISTS public.dimension_enum;
DROP TYPE IF EXISTS public.accion_auditoria_enum;
DROP EXTENSION IF EXISTS pgcrypto;
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: accion_auditoria_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.accion_auditoria_enum AS ENUM (
    'crear',
    'actualizar',
    'eliminar',
    'activar',
    'desactivar',
    'validar',
    'rechazar',
    'login',
    'logout',
    'exportar'
);


--
-- Name: dimension_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dimension_enum AS ENUM (
    'frecuencia',
    'normalidad',
    'gravedad'
);


--
-- Name: estatus_institucion_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estatus_institucion_enum AS ENUM (
    'pendiente',
    'activa',
    'inactiva',
    'rechazada',
    'suspendida'
);


--
-- Name: rol_usuario_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_usuario_enum AS ENUM (
    'admin',
    'centro',
    'super_admin',
    'owner_institucion',
    'admin_institucion',
    'analista',
    'operador'
);


--
-- Name: app_current_institucion_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_institucion_id() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_institucion_id', true), '')::BIGINT
$$;


--
-- Name: app_current_is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_is_super_admin', true), '')::BOOLEAN, FALSE)
$$;


--
-- Name: app_login_candidates_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_login_candidates_by_email(p_email text) RETURNS TABLE(user_id uuid, email text, nombre text, rol text, password_hash text, activo boolean, institucion_id bigint, institucion_slug text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: app_resolve_institucion_id_by_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_resolve_institucion_id_by_slug(p_slug text) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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


--
-- Name: FUNCTION app_resolve_institucion_id_by_slug(p_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.app_resolve_institucion_id_by_slug(p_slug text) IS 'Resuelve institucion_id desde slug para requests publicos multitenant con RLS activo.';


--
-- Name: app_resolve_public_access_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_resolve_public_access_slug(p_slug text) RETURNS TABLE(kind text, institucion_id bigint, institucion_slug text, centro_id bigint, centro_slug text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION app_resolve_public_access_slug(p_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.app_resolve_public_access_slug(p_slug text) IS 'Resuelve un slug publico a una institucion activa o a un centro activo para redireccionar la entrada a la encuesta.';


--
-- Name: app_slugify_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_slugify_text(p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
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
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validar_auditoria_mismo_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_auditoria_mismo_tenant() RETURNS trigger
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


--
-- Name: validar_comentario_analisis_mismo_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_comentario_analisis_mismo_tenant() RETURNS trigger
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


--
-- Name: validar_encuesta_mismo_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_encuesta_mismo_tenant() RETURNS trigger
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


--
-- Name: validar_owner_institucion_mismo_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_owner_institucion_mismo_tenant() RETURNS trigger
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


--
-- Name: validar_usuario_centro_mismo_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_usuario_centro_mismo_tenant() RETURNS trigger
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    institucion_id bigint,
    usuario_id uuid,
    accion public.accion_auditoria_enum NOT NULL,
    entidad text NOT NULL,
    entidad_id text,
    detalle_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: centros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.centros (
    id bigint NOT NULL,
    tipo text NOT NULL,
    nombre text NOT NULL,
    clave text,
    ciudad text,
    estado text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    institucion_id bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text NOT NULL,
    CONSTRAINT centros_tipo_check CHECK ((tipo = ANY (ARRAY['escolar'::text, 'laboral'::text])))
);


--
-- Name: centros_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.centros_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: centros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.centros_id_seq OWNED BY public.centros.id;


--
-- Name: comentario_analisis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentario_analisis (
    id bigint NOT NULL,
    encuesta_id uuid NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    pipeline_version text DEFAULT 'v1'::text NOT NULL,
    spacy_model text DEFAULT 'es_core_news_md'::text NOT NULL,
    embedding_model text,
    idioma text DEFAULT 'es'::text NOT NULL,
    texto_normalizado text,
    resumen text,
    keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    entidades jsonb DEFAULT '[]'::jsonb NOT NULL,
    tokens_count integer,
    caracteres_count integer,
    confianza_general numeric(6,5),
    error_detalle text,
    analizado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sentimiento_label text,
    sentimiento_score numeric(6,5),
    emocion_label text,
    emocion_score numeric(6,5),
    emociones jsonb,
    institucion_id bigint NOT NULL,
    CONSTRAINT comentario_analisis_confianza_general_check CHECK (((confianza_general IS NULL) OR ((confianza_general >= (0)::numeric) AND (confianza_general <= (1)::numeric)))),
    CONSTRAINT comentario_analisis_emocion_label_check CHECK (((emocion_label IS NULL) OR (emocion_label = ANY (ARRAY['indignacion'::text, 'miedo'::text, 'tristeza'::text, 'disgusto'::text, 'impotencia'::text, 'esperanza'::text, 'neutralidad'::text])))),
    CONSTRAINT comentario_analisis_emocion_score_check CHECK (((emocion_score IS NULL) OR ((emocion_score >= (0)::numeric) AND (emocion_score <= (1)::numeric)))),
    CONSTRAINT comentario_analisis_emociones_json_check CHECK (((emociones IS NULL) OR (jsonb_typeof(emociones) = 'object'::text))),
    CONSTRAINT comentario_analisis_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'procesado'::text, 'error'::text]))),
    CONSTRAINT comentario_analisis_sentimiento_label_check CHECK (((sentimiento_label IS NULL) OR (sentimiento_label = ANY (ARRAY['positivo'::text, 'neutral'::text, 'negativo'::text])))),
    CONSTRAINT comentario_analisis_sentimiento_score_check CHECK (((sentimiento_score IS NULL) OR ((sentimiento_score >= ('-1'::integer)::numeric) AND (sentimiento_score <= (1)::numeric))))
);


--
-- Name: TABLE comentario_analisis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comentario_analisis IS 'Resultado derivado del procesamiento NLP de encuestas.comentario. Una fila por encuesta.';


--
-- Name: COLUMN comentario_analisis.sentimiento_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comentario_analisis.sentimiento_label IS 'Polaridad general existente del comentario: positivo, neutral o negativo.';


--
-- Name: COLUMN comentario_analisis.sentimiento_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comentario_analisis.sentimiento_score IS 'Score firmado de polaridad general en rango [-1, 1].';


--
-- Name: COLUMN comentario_analisis.emocion_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comentario_analisis.emocion_label IS 'Emocion principal detectada por modelo de emociones. Valores esperados: anger, disgust, fear, joy, sadness, surprise, others.';


--
-- Name: COLUMN comentario_analisis.emocion_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comentario_analisis.emocion_score IS 'Confianza de la emocion principal en rango [0, 1].';


--
-- Name: COLUMN comentario_analisis.emociones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comentario_analisis.emociones IS 'Distribucion completa de probabilidades por emocion en formato JSONB.';


--
-- Name: comentario_analisis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comentario_analisis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comentario_analisis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comentario_analisis_id_seq OWNED BY public.comentario_analisis.id;


--
-- Name: comentario_tema; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentario_tema (
    id bigint NOT NULL,
    analisis_id bigint NOT NULL,
    tema_clave text NOT NULL,
    tema_etiqueta text NOT NULL,
    score numeric(6,5),
    rank smallint,
    origen text DEFAULT 'nlp'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comentario_tema_rank_check CHECK (((rank IS NULL) OR (rank >= 1))),
    CONSTRAINT comentario_tema_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (1)::numeric))))
);


--
-- Name: TABLE comentario_tema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comentario_tema IS 'Temas, categorias o etiquetas detectadas para cada comentario analizado.';


--
-- Name: comentario_tema_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comentario_tema_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comentario_tema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comentario_tema_id_seq OWNED BY public.comentario_tema.id;


--
-- Name: configuracion_institucion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_institucion (
    institucion_id bigint NOT NULL,
    nombre_publico text,
    logo_url text,
    color_primario text,
    color_secundario text,
    dominio_permitido text,
    permite_autoregistro boolean DEFAULT true NOT NULL,
    requiere_correo_institucional boolean DEFAULT false CONSTRAINT configuracion_institucion_requiere_correo_instituciona_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    color_apoyo text
);


--
-- Name: encuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encuestas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instrumento_id text DEFAULT 'mujer_alerta_v1'::text NOT NULL,
    centro_id bigint NOT NULL,
    email text,
    email_hash text,
    genero_id bigint NOT NULL,
    edad smallint NOT NULL,
    consent boolean DEFAULT true NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comentario text,
    institucion_id bigint NOT NULL,
    CONSTRAINT encuestas_comentario_len_check CHECK (((comentario IS NULL) OR (length(comentario) <= 2000))),
    CONSTRAINT encuestas_edad_check CHECK (((edad >= 10) AND (edad <= 120)))
);


--
-- Name: generos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generos (
    id bigint NOT NULL,
    clave text NOT NULL,
    etiqueta text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: generos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.generos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: generos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.generos_id_seq OWNED BY public.generos.id;


--
-- Name: instituciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instituciones (
    id bigint NOT NULL,
    nombre text NOT NULL,
    slug text NOT NULL,
    tipo text DEFAULT 'universidad'::text NOT NULL,
    email_contacto text,
    telefono text,
    pais text DEFAULT 'México'::text,
    estado text,
    ciudad text,
    activo boolean DEFAULT false NOT NULL,
    estatus_validacion public.estatus_institucion_enum DEFAULT 'pendiente'::public.estatus_institucion_enum NOT NULL,
    owner_user_id uuid,
    validado_at timestamp with time zone,
    validado_por uuid,
    observaciones_validacion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instituciones_tipo_check CHECK ((tipo = ANY (ARRAY['universidad'::text, 'empresa'::text, 'institucion'::text])))
);


--
-- Name: instituciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.instituciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: instituciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.instituciones_id_seq OWNED BY public.instituciones.id;


--
-- Name: registro_institucional_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_institucional_solicitudes (
    id bigint NOT NULL,
    institucion_nombre text NOT NULL,
    tipo text DEFAULT 'institucion'::text NOT NULL,
    nombre_contacto text NOT NULL,
    cargo_contacto text,
    email_contacto text NOT NULL,
    telefono_contacto text,
    estado text,
    ciudad text,
    sitio_web text,
    slug_deseado text,
    estatus text DEFAULT 'pendiente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    institucion_id bigint,
    CONSTRAINT registro_institucional_email_check CHECK ((POSITION(('@'::text) IN (email_contacto)) > 1)),
    CONSTRAINT registro_institucional_estatus_check CHECK ((estatus = ANY (ARRAY['pendiente'::text, 'contactado'::text, 'aprobado'::text, 'rechazado'::text]))),
    CONSTRAINT registro_institucional_slug_check CHECK (((slug_deseado IS NULL) OR (slug_deseado ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))),
    CONSTRAINT registro_institucional_tipo_check CHECK ((tipo = ANY (ARRAY['universidad'::text, 'empresa'::text, 'institucion'::text])))
);


--
-- Name: registro_institucional_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registro_institucional_solicitudes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registro_institucional_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registro_institucional_solicitudes_id_seq OWNED BY public.registro_institucional_solicitudes.id;


--
-- Name: respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.respuestas (
    id bigint NOT NULL,
    encuesta_id uuid NOT NULL,
    pregunta_id text NOT NULL,
    dimension public.dimension_enum NOT NULL,
    valor smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT respuestas_pregunta_id_check CHECK ((pregunta_id ~ '^P([1-9]|1[0-6])$'::text)),
    CONSTRAINT respuestas_valor_check CHECK (((valor >= 1) AND (valor <= 5)))
);


--
-- Name: respuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.respuestas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: respuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.respuestas_id_seq OWNED BY public.respuestas.id;


--
-- Name: usuario_centros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_centros (
    usuario_id uuid NOT NULL,
    centro_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    institucion_id bigint NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    nombre text NOT NULL,
    rol public.rol_usuario_enum DEFAULT 'centro'::public.rol_usuario_enum NOT NULL,
    password_hash text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    institucion_id bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_comentario_analisis_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_comentario_analisis_resumen AS
 SELECT ca.id,
    ca.encuesta_id,
    ca.institucion_id,
    e.centro_id,
    c.nombre AS centro_nombre,
    i.nombre AS institucion_nombre,
    i.slug AS institucion_slug,
    ca.estado,
    ca.pipeline_version,
    ca.spacy_model,
    ca.embedding_model,
    ca.idioma,
    ca.resumen,
    ca.keywords,
    ca.entidades,
    ca.sentimiento_label,
    ca.sentimiento_score,
    e.finished_at,
    e.created_at,
    ca.emocion_label,
    ca.emocion_score,
    ca.emociones,
    ca.tokens_count,
    ca.caracteres_count,
    ca.confianza_general,
    ca.error_detalle,
    ca.analizado_at,
    ca.updated_at,
    e.comentario,
    ca.texto_normalizado
   FROM (((public.comentario_analisis ca
     JOIN public.encuestas e ON ((e.id = ca.encuesta_id)))
     JOIN public.centros c ON ((c.id = e.centro_id)))
     JOIN public.instituciones i ON ((i.id = ca.institucion_id)));


--
-- Name: v_comentarios_pendientes_nlp; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_comentarios_pendientes_nlp AS
 SELECT e.id AS encuesta_id,
    e.institucion_id,
    i.nombre AS institucion_nombre,
    i.slug AS institucion_slug,
    e.centro_id,
    e.created_at,
    e.finished_at,
    e.comentario
   FROM ((public.encuestas e
     JOIN public.instituciones i ON ((i.id = e.institucion_id)))
     LEFT JOIN public.comentario_analisis ca ON ((ca.encuesta_id = e.id)))
  WHERE ((e.finished_at IS NOT NULL) AND (e.comentario IS NOT NULL) AND (btrim(e.comentario) <> ''::text) AND ((ca.id IS NULL) OR (ca.estado = ANY (ARRAY['pendiente'::text, 'error'::text]))));


--
-- Name: VIEW v_comentarios_pendientes_nlp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_comentarios_pendientes_nlp IS 'Comentarios finalizados y no vacios que aun no tienen analisis procesado exitosamente, segmentados por institucion.';


--
-- Name: v_encuestas_conteo_respuestas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_encuestas_conteo_respuestas AS
 SELECT e.id AS encuesta_id,
    e.institucion_id,
    e.centro_id,
    count(r.id) AS total_respuestas
   FROM (public.encuestas e
     LEFT JOIN public.respuestas r ON ((r.encuesta_id = e.id)))
  GROUP BY e.id, e.institucion_id, e.centro_id;


--
-- Name: v_matriz_tipo_dimension; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_matriz_tipo_dimension AS
 WITH mapa AS (
         SELECT t_1.pregunta_id,
            t_1.tipo_num
           FROM ( VALUES ('P1'::text,1), ('P2'::text,1), ('P3'::text,2), ('P4'::text,2), ('P5'::text,3), ('P6'::text,3), ('P7'::text,4), ('P8'::text,4), ('P9'::text,5), ('P10'::text,5), ('P11'::text,6), ('P12'::text,6), ('P13'::text,7), ('P14'::text,7), ('P15'::text,8), ('P16'::text,8)) t_1(pregunta_id, tipo_num)
        ), tipos AS (
         SELECT t_1.tipo_num,
            t_1.tipo_nombre
           FROM ( VALUES (1,'Descalificación / Humillación'::text), (2,'Discriminación por ser mujer'::text), (3,'Sexualización / Comentarios sexuales'::text), (4,'Hostigamiento sexual'::text), (5,'Abuso de poder'::text), (6,'Obstaculización académica o laboral'::text), (7,'Violencia digital / mediática'::text), (8,'Agresión o amenaza'::text)) t_1(tipo_num, tipo_nombre)
        )
 SELECT e.institucion_id,
    r.encuesta_id,
    t.tipo_num,
    t.tipo_nombre,
    r.dimension,
    round(avg(r.valor), 2) AS promedio
   FROM (((public.respuestas r
     JOIN public.encuestas e ON ((e.id = r.encuesta_id)))
     JOIN mapa m ON ((m.pregunta_id = r.pregunta_id)))
     JOIN tipos t ON ((t.tipo_num = m.tipo_num)))
  GROUP BY e.institucion_id, r.encuesta_id, t.tipo_num, t.tipo_nombre, r.dimension;


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: centros id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centros ALTER COLUMN id SET DEFAULT nextval('public.centros_id_seq'::regclass);


--
-- Name: comentario_analisis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis ALTER COLUMN id SET DEFAULT nextval('public.comentario_analisis_id_seq'::regclass);


--
-- Name: comentario_tema id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_tema ALTER COLUMN id SET DEFAULT nextval('public.comentario_tema_id_seq'::regclass);


--
-- Name: generos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generos ALTER COLUMN id SET DEFAULT nextval('public.generos_id_seq'::regclass);


--
-- Name: instituciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instituciones ALTER COLUMN id SET DEFAULT nextval('public.instituciones_id_seq'::regclass);


--
-- Name: registro_institucional_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_institucional_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.registro_institucional_solicitudes_id_seq'::regclass);


--
-- Name: respuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_id_seq'::regclass);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: centros centros_id_institucion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_id_institucion_key UNIQUE (id, institucion_id);


--
-- Name: centros centros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_pkey PRIMARY KEY (id);


--
-- Name: comentario_analisis comentario_analisis_encuesta_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis
    ADD CONSTRAINT comentario_analisis_encuesta_id_key UNIQUE (encuesta_id);


--
-- Name: comentario_analisis comentario_analisis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis
    ADD CONSTRAINT comentario_analisis_pkey PRIMARY KEY (id);


--
-- Name: comentario_tema comentario_tema_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_tema
    ADD CONSTRAINT comentario_tema_pkey PRIMARY KEY (id);


--
-- Name: comentario_tema comentario_tema_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_tema
    ADD CONSTRAINT comentario_tema_unique UNIQUE (analisis_id, tema_clave);


--
-- Name: configuracion_institucion configuracion_institucion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_institucion
    ADD CONSTRAINT configuracion_institucion_pkey PRIMARY KEY (institucion_id);


--
-- Name: encuestas encuestas_id_institucion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_id_institucion_key UNIQUE (id, institucion_id);


--
-- Name: encuestas encuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_pkey PRIMARY KEY (id);


--
-- Name: generos generos_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generos
    ADD CONSTRAINT generos_clave_key UNIQUE (clave);


--
-- Name: generos generos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generos
    ADD CONSTRAINT generos_pkey PRIMARY KEY (id);


--
-- Name: instituciones instituciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instituciones
    ADD CONSTRAINT instituciones_pkey PRIMARY KEY (id);


--
-- Name: instituciones instituciones_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instituciones
    ADD CONSTRAINT instituciones_slug_key UNIQUE (slug);


--
-- Name: registro_institucional_solicitudes registro_institucional_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_institucional_solicitudes
    ADD CONSTRAINT registro_institucional_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: respuestas respuestas_encuesta_id_pregunta_id_dimension_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_encuesta_id_pregunta_id_dimension_key UNIQUE (encuesta_id, pregunta_id, dimension);


--
-- Name: respuestas respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_pkey PRIMARY KEY (id);


--
-- Name: usuario_centros usuario_centros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_pkey PRIMARY KEY (usuario_id, centro_id);


--
-- Name: usuarios usuarios_id_institucion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_institucion_key UNIQUE (id, institucion_id);


--
-- Name: usuarios usuarios_institucion_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_institucion_email_key UNIQUE (institucion_id, email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_auditoria_entidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_entidad ON public.auditoria USING btree (entidad, created_at DESC);


--
-- Name: idx_auditoria_institucion_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_institucion_created ON public.auditoria USING btree (institucion_id, created_at DESC);


--
-- Name: idx_auditoria_usuario_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_usuario_created ON public.auditoria USING btree (usuario_id, created_at DESC);


--
-- Name: idx_centros_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centros_institucion ON public.centros USING btree (institucion_id);


--
-- Name: idx_centros_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centros_nombre ON public.centros USING gin (to_tsvector('spanish'::regconfig, nombre));


--
-- Name: idx_centros_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centros_tipo ON public.centros USING btree (tipo);


--
-- Name: idx_comentario_analisis_analizado_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_analisis_analizado_at ON public.comentario_analisis USING btree (analizado_at DESC);


--
-- Name: idx_comentario_analisis_emocion_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_analisis_emocion_label ON public.comentario_analisis USING btree (emocion_label);


--
-- Name: idx_comentario_analisis_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_analisis_estado ON public.comentario_analisis USING btree (estado);


--
-- Name: idx_comentario_analisis_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_analisis_institucion ON public.comentario_analisis USING btree (institucion_id);


--
-- Name: idx_comentario_tema_analisis_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_tema_analisis_rank ON public.comentario_tema USING btree (analisis_id, rank);


--
-- Name: idx_comentario_tema_tema_clave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comentario_tema_tema_clave ON public.comentario_tema USING btree (tema_clave);


--
-- Name: idx_encuestas_centro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_centro ON public.encuestas USING btree (centro_id);


--
-- Name: idx_encuestas_email_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_email_hash ON public.encuestas USING btree (email_hash);


--
-- Name: idx_encuestas_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_institucion ON public.encuestas USING btree (institucion_id);


--
-- Name: idx_encuestas_institucion_centro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_institucion_centro ON public.encuestas USING btree (institucion_id, centro_id);


--
-- Name: idx_encuestas_institucion_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_institucion_created ON public.encuestas USING btree (institucion_id, created_at DESC);


--
-- Name: idx_encuestas_instrumento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_instrumento ON public.encuestas USING btree (instrumento_id);


--
-- Name: idx_instituciones_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instituciones_activo ON public.instituciones USING btree (activo);


--
-- Name: idx_instituciones_estatus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instituciones_estatus ON public.instituciones USING btree (estatus_validacion);


--
-- Name: idx_registro_institucional_solicitudes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_institucional_solicitudes_email ON public.registro_institucional_solicitudes USING btree (lower(email_contacto));


--
-- Name: idx_registro_institucional_solicitudes_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registro_institucional_solicitudes_slug ON public.registro_institucional_solicitudes USING btree (lower(slug_deseado)) WHERE (slug_deseado IS NOT NULL);


--
-- Name: idx_respuestas_encuesta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuestas_encuesta ON public.respuestas USING btree (encuesta_id);


--
-- Name: idx_respuestas_preg_dim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuestas_preg_dim ON public.respuestas USING btree (pregunta_id, dimension);


--
-- Name: idx_usuario_centros_centro_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_centros_centro_id ON public.usuario_centros USING btree (centro_id);


--
-- Name: idx_usuario_centros_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_centros_institucion ON public.usuario_centros USING btree (institucion_id);


--
-- Name: idx_usuarios_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_institucion ON public.usuarios USING btree (institucion_id);


--
-- Name: uq_centros_institucion_clave; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_centros_institucion_clave ON public.centros USING btree (institucion_id, clave) WHERE (clave IS NOT NULL);


--
-- Name: uq_centros_institucion_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_centros_institucion_slug ON public.centros USING btree (institucion_id, slug);


--
-- Name: uq_un_owner_por_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_un_owner_por_institucion ON public.usuarios USING btree (institucion_id) WHERE (rol = 'owner_institucion'::public.rol_usuario_enum);


--
-- Name: centros trg_set_updated_at_centros; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_centros BEFORE UPDATE ON public.centros FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comentario_analisis trg_set_updated_at_comentario_analisis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_comentario_analisis BEFORE UPDATE ON public.comentario_analisis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configuracion_institucion trg_set_updated_at_configuracion_institucion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_configuracion_institucion BEFORE UPDATE ON public.configuracion_institucion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: instituciones trg_set_updated_at_instituciones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_instituciones BEFORE UPDATE ON public.instituciones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: registro_institucional_solicitudes trg_set_updated_at_registro_institucional_solicitudes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_registro_institucional_solicitudes BEFORE UPDATE ON public.registro_institucional_solicitudes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: usuarios trg_set_updated_at_usuarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: auditoria trg_validar_auditoria_mismo_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_auditoria_mismo_tenant BEFORE INSERT OR UPDATE ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.validar_auditoria_mismo_tenant();


--
-- Name: comentario_analisis trg_validar_comentario_analisis_mismo_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_comentario_analisis_mismo_tenant BEFORE INSERT OR UPDATE ON public.comentario_analisis FOR EACH ROW EXECUTE FUNCTION public.validar_comentario_analisis_mismo_tenant();


--
-- Name: encuestas trg_validar_encuesta_mismo_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_encuesta_mismo_tenant BEFORE INSERT OR UPDATE ON public.encuestas FOR EACH ROW EXECUTE FUNCTION public.validar_encuesta_mismo_tenant();


--
-- Name: instituciones trg_validar_owner_institucion_mismo_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_owner_institucion_mismo_tenant BEFORE INSERT OR UPDATE OF owner_user_id ON public.instituciones FOR EACH ROW EXECUTE FUNCTION public.validar_owner_institucion_mismo_tenant();


--
-- Name: usuario_centros trg_validar_usuario_centro_mismo_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_usuario_centro_mismo_tenant BEFORE INSERT OR UPDATE ON public.usuario_centros FOR EACH ROW EXECUTE FUNCTION public.validar_usuario_centro_mismo_tenant();


--
-- Name: auditoria auditoria_institucion_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_institucion_fk FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE SET NULL;


--
-- Name: auditoria auditoria_usuario_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_fk FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: centros centros_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE RESTRICT;


--
-- Name: comentario_analisis comentario_analisis_encuesta_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis
    ADD CONSTRAINT comentario_analisis_encuesta_institucion_fkey FOREIGN KEY (encuesta_id, institucion_id) REFERENCES public.encuestas(id, institucion_id) ON DELETE CASCADE;


--
-- Name: comentario_analisis comentario_analisis_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis
    ADD CONSTRAINT comentario_analisis_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE RESTRICT;


--
-- Name: comentario_tema comentario_tema_analisis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_tema
    ADD CONSTRAINT comentario_tema_analisis_id_fkey FOREIGN KEY (analisis_id) REFERENCES public.comentario_analisis(id) ON DELETE CASCADE;


--
-- Name: configuracion_institucion configuracion_institucion_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_institucion
    ADD CONSTRAINT configuracion_institucion_fk FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE CASCADE;


--
-- Name: encuestas encuestas_centro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES public.centros(id) ON DELETE RESTRICT;


--
-- Name: encuestas encuestas_genero_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_genero_id_fkey FOREIGN KEY (genero_id) REFERENCES public.generos(id);


--
-- Name: encuestas encuestas_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE RESTRICT;


--
-- Name: instituciones instituciones_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instituciones
    ADD CONSTRAINT instituciones_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: instituciones instituciones_validado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instituciones
    ADD CONSTRAINT instituciones_validado_por_fkey FOREIGN KEY (validado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: registro_institucional_solicitudes registro_institucional_solicitudes_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_institucional_solicitudes
    ADD CONSTRAINT registro_institucional_solicitudes_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE SET NULL;


--
-- Name: respuestas respuestas_encuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id) ON DELETE CASCADE;


--
-- Name: usuario_centros usuario_centros_centro_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_centro_institucion_fkey FOREIGN KEY (centro_id, institucion_id) REFERENCES public.centros(id, institucion_id) ON DELETE RESTRICT;


--
-- Name: usuario_centros usuario_centros_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE RESTRICT;


--
-- Name: usuario_centros usuario_centros_usuario_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_usuario_institucion_fkey FOREIGN KEY (usuario_id, institucion_id) REFERENCES public.usuarios(id, institucion_id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.instituciones(id) ON DELETE RESTRICT;


--
-- Name: auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: centros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;

--
-- Name: comentario_analisis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comentario_analisis ENABLE ROW LEVEL SECURITY;

--
-- Name: comentario_tema; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comentario_tema ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_institucion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_institucion ENABLE ROW LEVEL SECURITY;

--
-- Name: encuestas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;

--
-- Name: instituciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria p_auditoria_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_auditoria_tenant ON public.auditoria USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: centros p_centros_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_centros_tenant ON public.centros USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: comentario_analisis p_comentario_analisis_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_comentario_analisis_tenant ON public.comentario_analisis USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: comentario_tema p_comentario_tema_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_comentario_tema_tenant ON public.comentario_tema USING ((public.app_current_is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.comentario_analisis ca
  WHERE ((ca.id = comentario_tema.analisis_id) AND (ca.institucion_id = public.app_current_institucion_id())))))) WITH CHECK ((public.app_current_is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.comentario_analisis ca
  WHERE ((ca.id = comentario_tema.analisis_id) AND (ca.institucion_id = public.app_current_institucion_id()))))));


--
-- Name: configuracion_institucion p_configuracion_institucion_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_configuracion_institucion_tenant ON public.configuracion_institucion USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: encuestas p_encuestas_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_encuestas_tenant ON public.encuestas USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: instituciones p_instituciones_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_instituciones_tenant ON public.instituciones USING ((public.app_current_is_super_admin() OR (id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (id = public.app_current_institucion_id())));


--
-- Name: respuestas p_respuestas_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_respuestas_tenant ON public.respuestas USING ((public.app_current_is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.encuestas e
  WHERE ((e.id = respuestas.encuesta_id) AND (e.institucion_id = public.app_current_institucion_id())))))) WITH CHECK ((public.app_current_is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.encuestas e
  WHERE ((e.id = respuestas.encuesta_id) AND (e.institucion_id = public.app_current_institucion_id()))))));


--
-- Name: usuario_centros p_usuario_centros_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_usuario_centros_tenant ON public.usuario_centros USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: usuarios p_usuarios_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_usuarios_tenant ON public.usuarios USING ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id()))) WITH CHECK ((public.app_current_is_super_admin() OR (institucion_id = public.app_current_institucion_id())));


--
-- Name: respuestas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_centros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuario_centros ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 1IygOhrU1dAgo1O0r1BmwCKm9w8XrHkkgW27V7gaOO00Ma6xNYLrczehPd7bZBl

