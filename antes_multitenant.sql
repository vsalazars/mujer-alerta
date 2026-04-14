--
-- PostgreSQL database dump
--

\restrict 8899SDfRCsItpLOHo4kuu48hkxepdNZue8fDmrIoEHW0MfyDvJ0DHzjql2bxbZ5

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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: dimension_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dimension_enum AS ENUM (
    'frecuencia',
    'normalidad',
    'gravedad'
);


--
-- Name: rol_usuario_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_usuario_enum AS ENUM (
    'admin',
    'centro'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
    last_login_at timestamp with time zone
);


--
-- Name: v_comentario_analisis_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_comentario_analisis_resumen AS
 SELECT ca.id,
    ca.encuesta_id,
    e.centro_id,
    c.nombre AS centro_nombre,
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
   FROM ((public.comentario_analisis ca
     JOIN public.encuestas e ON ((e.id = ca.encuesta_id)))
     JOIN public.centros c ON ((c.id = e.centro_id)));


--
-- Name: v_comentarios_pendientes_nlp; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_comentarios_pendientes_nlp AS
 SELECT e.id AS encuesta_id,
    e.centro_id,
    e.created_at,
    e.finished_at,
    e.comentario
   FROM (public.encuestas e
     LEFT JOIN public.comentario_analisis ca ON ((ca.encuesta_id = e.id)))
  WHERE ((e.finished_at IS NOT NULL) AND (e.comentario IS NOT NULL) AND (btrim(e.comentario) <> ''::text) AND ((ca.id IS NULL) OR (ca.estado = ANY (ARRAY['pendiente'::text, 'error'::text]))));


--
-- Name: VIEW v_comentarios_pendientes_nlp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_comentarios_pendientes_nlp IS 'Comentarios finalizados y no vacios que aun no tienen analisis procesado exitosamente.';


--
-- Name: v_encuestas_conteo_respuestas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_encuestas_conteo_respuestas AS
 SELECT e.id AS encuesta_id,
    e.centro_id,
    count(r.id) AS total_respuestas
   FROM (public.encuestas e
     LEFT JOIN public.respuestas r ON ((r.encuesta_id = e.id)))
  GROUP BY e.id, e.centro_id;


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
 SELECT r.encuesta_id,
    t.tipo_num,
    t.tipo_nombre,
    r.dimension,
    round(avg(r.valor), 2) AS promedio
   FROM ((public.respuestas r
     JOIN mapa m ON ((m.pregunta_id = r.pregunta_id)))
     JOIN tipos t ON ((t.tipo_num = m.tipo_num)))
  GROUP BY r.encuesta_id, t.tipo_num, t.tipo_nombre, r.dimension;


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
-- Name: respuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_id_seq'::regclass);


--
-- Name: centros centros_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_clave_key UNIQUE (clave);


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
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


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
-- Name: idx_encuestas_instrumento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encuestas_instrumento ON public.encuestas USING btree (instrumento_id);


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
-- Name: comentario_analisis comentario_analisis_encuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_analisis
    ADD CONSTRAINT comentario_analisis_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id) ON DELETE CASCADE;


--
-- Name: comentario_tema comentario_tema_analisis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentario_tema
    ADD CONSTRAINT comentario_tema_analisis_id_fkey FOREIGN KEY (analisis_id) REFERENCES public.comentario_analisis(id) ON DELETE CASCADE;


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
-- Name: respuestas respuestas_encuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id) ON DELETE CASCADE;


--
-- Name: usuario_centros usuario_centros_centro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES public.centros(id) ON DELETE RESTRICT;


--
-- Name: usuario_centros usuario_centros_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_centros
    ADD CONSTRAINT usuario_centros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8899SDfRCsItpLOHo4kuu48hkxepdNZue8fDmrIoEHW0MfyDvJ0DHzjql2bxbZ5

