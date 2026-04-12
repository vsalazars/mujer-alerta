--
-- PostgreSQL database dump
--

\restrict J0NSxVx4uDkB0BHzXLINFztvx9aLTxpQT24VJzlVLP518F9AsMjuef8TZcbQysn

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
-- Name: generos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generos ALTER COLUMN id SET DEFAULT nextval('public.generos_id_seq'::regclass);


--
-- Name: respuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_id_seq'::regclass);


--
-- Data for Name: centros; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.centros (id, tipo, nombre, clave, ciudad, estado, activo, created_at) FROM stdin;
2	laboral	Sección 11 SNTE	Sección-11	CDMX	CDMX	t	2025-12-24 01:48:42.503036-06
1	escolar	UPIIITA	IPN-UPIITA	CDMX	CDMX	t	2025-12-22 22:31:26.985374-06
\.


--
-- Data for Name: encuestas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encuestas (id, instrumento_id, centro_id, email, email_hash, genero_id, edad, consent, started_at, finished_at, created_at, comentario) FROM stdin;
223e0ba1-e2e1-4f10-a6cb-a615ccecff33	mujer_alerta_v1	1	\N	\N	3	19	t	2025-12-22 23:10:43.090838-06	\N	2025-12-22 23:10:43.090838-06	\N
9238a6aa-c264-4e63-9cd6-a52574a14ba7	mujer_alerta_v1	1	\N	\N	2	21	t	2025-12-22 23:14:44.097778-06	\N	2025-12-22 23:14:44.097778-06	\N
9c31004e-5880-4128-b359-b3db66c38ddb	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-22 23:18:34.10518-06	\N	2025-12-22 23:18:34.10518-06	\N
f589cd47-3c0e-4db9-a03f-dbf62387755b	mujer_alerta_v1	1	\N	\N	2	15	t	2025-12-22 23:19:27.124499-06	\N	2025-12-22 23:19:27.124499-06	\N
7ddaa0a6-dac7-4064-94db-61bfad03c512	mujer_alerta_v1	1	\N	\N	1	12	t	2025-12-22 23:20:32.488212-06	\N	2025-12-22 23:20:32.488212-06	\N
d672471d-b9ff-4bfa-a6b9-b2f995696bf4	mujer_alerta_v1	1	\N	\N	2	15	t	2025-12-22 23:24:16.440321-06	\N	2025-12-22 23:24:16.440321-06	\N
7dfd62ca-f6d8-4961-b927-dfd3e93fa2bb	mujer_alerta_v1	1	\N	\N	1	20	t	2025-12-22 23:26:19.935988-06	\N	2025-12-22 23:26:19.935988-06	\N
7bceedef-6760-4f4f-8b1f-eb6bb35c8821	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-22 23:29:08.128294-06	\N	2025-12-22 23:29:08.128294-06	\N
0c195731-23e4-4b51-a8fb-ccc2341c89f4	mujer_alerta_v1	1	\N	\N	3	56	t	2025-12-22 23:31:18.390708-06	\N	2025-12-22 23:31:18.390708-06	\N
f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	mujer_alerta_v1	1	\N	\N	2	20	t	2025-12-22 23:48:28.806097-06	\N	2025-12-22 23:48:28.806097-06	\N
7131bcfd-fdf4-481c-8ddf-e9344efbed87	mujer_alerta_v1	1	\N	\N	2	78	t	2025-12-22 23:54:02.846749-06	\N	2025-12-22 23:54:02.846749-06	\N
cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	mujer_alerta_v1	1	\N	\N	2	78	t	2025-12-22 23:57:21.980057-06	\N	2025-12-22 23:57:21.980057-06	\N
8334e638-51c0-471c-8118-9b9cf55f1cbd	mujer_alerta_v1	1	\N	\N	4	12	t	2025-12-23 00:40:40.530105-06	\N	2025-12-23 00:40:40.530105-06	\N
a1ff5612-30c0-481d-af9b-2a563871869d	mujer_alerta_v1	1	\N	\N	3	20	t	2025-12-23 00:42:29.836692-06	\N	2025-12-23 00:42:29.836692-06	\N
e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	mujer_alerta_v1	1	\N	\N	2	34	t	2025-12-23 01:03:05.111933-06	\N	2025-12-23 01:03:05.111933-06	\N
2af03b0f-91a2-4c09-baaf-46ccd0749197	mujer_alerta_v1	1	\N	\N	3	45	t	2025-12-23 01:06:03.89115-06	\N	2025-12-23 01:06:03.89115-06	\N
78a23e73-19cd-4cff-ab6c-1acceff73e66	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-23 01:15:00.378044-06	\N	2025-12-23 01:15:00.378044-06	\N
f06036f1-b0a7-41ae-b186-6d5d0b56d55f	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-23 01:36:24.143043-06	\N	2025-12-23 01:36:24.143043-06	\N
c9d3c582-4bc7-4e07-bb85-cf9097587be3	mujer_alerta_v1	1	\N	\N	3	78	t	2025-12-23 01:37:53.549901-06	\N	2025-12-23 01:37:53.549901-06	\N
8e5a2cb7-02c7-45c8-a3ea-5b9d35e5f265	mujer_alerta_v1	1	\N	\N	2	42	t	2025-12-23 02:26:04.421257-06	\N	2025-12-23 02:26:04.421257-06	\N
9ee4b8c8-b41d-475d-930c-2f83b32c4261	mujer_alerta_v1	1	\N	\N	3	78	t	2025-12-23 02:27:32.931278-06	\N	2025-12-23 02:27:32.931278-06	\N
34fa1f2e-ebfb-4f4e-9564-e17c5b227549	mujer_alerta_v1	1	\N	\N	2	10	t	2025-12-24 02:42:13.429749-06	\N	2025-12-24 02:42:13.429749-06	\N
7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	mujer_alerta_v1	1	\N	\N	1	15	t	2025-12-24 04:44:37.575025-06	\N	2025-12-24 04:44:37.575025-06	\N
a2bc9323-1ea5-48b8-ad8a-3f42d34e43f6	mujer_alerta_v1	1	\N	\N	8	15	t	2025-12-25 19:36:38.574407-06	\N	2025-12-25 19:36:38.574407-06	\N
e139e9b8-6f1f-4730-a8bc-8305d7f11e11	mujer_alerta_v1	1	ali@mail.com	\N	3	15	t	2025-12-25 12:51:15.253755-06	\N	2025-12-25 12:51:15.253755-06	\N
cb553e5a-3775-4769-8950-154389c39bdd	mujer_alerta_v1	1	gfggfdg	\N	3	48	t	2025-12-25 12:52:05.299144-06	\N	2025-12-25 12:52:05.299144-06	\N
ccf7fea8-8755-4236-8cc7-89aaee74f5bf	mujer_alerta_v1	1	mail@mailco.com	\N	3	20	t	2025-12-25 12:55:27.452169-06	\N	2025-12-25 12:55:27.452169-06	\N
df6c0bc6-9aeb-4290-8704-7c77def242f2	mujer_alerta_v1	1	paty@culona	\N	3	15	t	2025-12-25 13:02:35.990919-06	\N	2025-12-25 13:02:35.990919-06	\N
ae074147-2466-4adf-89fb-3827d099b556	mujer_alerta_v1	1	paty@mail.bom	\N	3	15	t	2025-12-25 13:05:52.011129-06	\N	2025-12-25 13:05:52.011129-06	\N
ba9b8487-b295-4b2a-8be7-f6de8f79bc03	mujer_alerta_v1	1	\N	\N	3	15	t	2025-12-25 13:06:39.349119-06	\N	2025-12-25 13:06:39.349119-06	\N
935150a3-a447-4adc-942c-150f29d64353	mujer_alerta_v1	1	paty@mail.com	\N	3	15	t	2025-12-25 13:13:53.785301-06	\N	2025-12-25 13:13:53.785301-06	\N
6f4b2de4-d3dd-4111-91c1-8e4f53a15eb2	mujer_alerta_v1	1	paty@mail.com	\N	3	16	t	2025-12-25 13:21:14.197795-06	\N	2025-12-25 13:21:14.197795-06	\N
11cdf54d-9201-4da2-a493-d725ef504604	mujer_alerta_v1	1	\N	\N	1	15	t	2025-12-25 13:29:59.857309-06	\N	2025-12-25 13:29:59.857309-06	\N
6f4b29e2-1c0f-4a27-a958-50a691690ad0	mujer_alerta_v1	1	paty@nalgona.mail	\N	1	15	t	2025-12-25 13:24:15.250352-06	2025-12-25 13:25:33.81964-06	2025-12-25 13:24:15.250352-06	El trozo de texto estándar de Lorem Ipsum usado desde el año 1500 es reproducido debajo para aquellos interesados. Las secciones 1.10.32 y 1.10.33
99abf3d3-f393-425d-8f38-7e35ac490475	mujer_alerta_v1	1	\N	\N	2	25	t	2025-12-25 18:40:14.151119-06	2025-12-25 18:41:26.103079-06	2025-12-25 18:40:14.151119-06	El trozo de texto estándar de Lorem Ipsum usado desde el año 1500 es reproducido debajo para aquellos interesados. Las secciones 1.10.32 y 1.10.33
20acd552-a741-4c31-be87-f9a4949797dd	mujer_alerta_v1	1	\N	\N	4	33	t	2025-12-25 18:49:28.257389-06	2025-12-25 18:50:21.189714-06	2025-12-25 18:49:28.257389-06	\N
0bc88783-9ae9-4f7d-b061-ccce7302f24f	mujer_alerta_v1	1	mail@mail.com	\N	1	15	t	2025-12-25 18:37:17.550894-06	2025-12-25 18:38:11.9906-06	2025-12-25 18:37:17.550894-06	El trozo de texto estándar de Lorem Ipsum usado desde el año 1500 es reproducido debajo para aquellos interesados. Las secciones 1.10.32 y 1.10.33
48f326d0-71e0-45f5-984e-77fb81133b9d	mujer_alerta_v1	1	\N	\N	2	56	t	2025-12-23 02:42:41.600951-06	2024-12-25 18:50:21.189714-06	2025-12-23 02:42:41.600951-06	\N
56222357-bef0-40db-9c3b-b2e93520fc01	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-23 15:59:15.693591-06	2024-12-25 18:50:21.189714-06	2025-12-23 15:59:15.693591-06	\N
59822a5b-cb10-4645-b7a8-637dc9bb2fb8	mujer_alerta_v1	1	\N	\N	3	16	t	2025-12-25 12:28:26.158712-06	2024-12-25 18:50:21.189714-06	2025-12-25 12:28:26.158712-06	\N
5ed565bc-991e-430e-877f-63f38ec7765e	mujer_alerta_v1	1	\N	\N	3	12	t	2025-12-22 23:32:39.68451-06	2024-12-25 18:50:21.189714-06	2025-12-22 23:32:39.68451-06	\N
62a98d2d-761a-40d4-b2b5-744cabd9153b	mujer_alerta_v1	1	test@ejemplo.com	\N	1	22	t	2025-12-22 22:32:49.284654-06	2024-12-25 18:50:21.189714-06	2025-12-22 22:32:49.284654-06	\N
678b0a0c-74db-4fb7-aa51-52856f8c4a95	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-22 23:14:05.239067-06	2024-12-25 18:50:21.189714-06	2025-12-22 23:14:05.239067-06	\N
68bac82d-26c2-4d7d-a5a9-0fb996cfa5a8	mujer_alerta_v1	1	paty@mail.com	\N	3	15	t	2025-12-25 13:15:05.295852-06	2024-12-25 18:50:21.189714-06	2025-12-25 13:15:05.295852-06	\N
6e02bcfc-e3a1-4cae-9773-69dfef549f41	mujer_alerta_v1	1	\N	\N	2	41	t	2025-12-23 02:11:31.924268-06	2024-12-25 18:50:21.189714-06	2025-12-23 02:11:31.924268-06	\N
20902056-ec59-48a5-8167-6c5410281f07	mujer_alerta_v1	1	\N	\N	7	15	t	2025-12-25 19:32:34.437573-06	2025-12-25 19:34:00.068155-06	2025-12-25 19:32:34.437573-06	Es un hecho establecido hace demasiado tiempo que un lector se distraerá con el contenido del texto de un sitio mientras que mira su diseño. El punto de usar Lorem Ipsum es que tiene una distribución más o menos normal de las letras, al contrario de usar textos como por ejemplo "Contenido aquí, contenido aquí". Estos textos hacen parecerlo un español que se puede leer. Muchos paquetes de autoedición y editores de páginas web usan el Lorem Ipsum como su texto por defecto, y al hacer una búsqueda de "Lorem Ipsum" va a dar por resultado muchos sitios web que usan este texto si se encuentran en estado de desarrollo. Muchas versiones han evolucionado a través de los años, algunas veces por accidente, otras veces a propósito (por ejemplo insertándole humor y cosas por el estilo).
3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	mujer_alerta_v1	1	yo@mail.com	\N	3	20	t	2025-12-25 12:44:27.300633-06	2025-12-25 12:45:28.233288-06	2025-12-25 12:44:27.300633-06	El trozo de texto estándar de Lorem Ipsum usado desde el año 1500 es reproducido debajo para aquellos interesados. Las secciones 1.10.32 y 1.10.33
e2986526-d3ac-4115-a46d-489687e4a5b6	mujer_alerta_v1	1	\N	\N	5	46	t	2025-12-25 18:51:18.315862-06	2025-12-25 18:52:14.512869-06	2025-12-25 18:51:18.315862-06	El trozo de texto estándar de Lorem Ipsum usado desde el año 1500 es reproducido debajo para aquellos interesados. Las secciones 1.10.32 y 1.10.33
95c01992-ff5c-4e98-8901-f90d2d9825c0	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-26 20:23:08.375774-06	2025-12-26 20:24:06.237453-06	2025-12-26 20:23:08.375774-06	Coemntario opcional
80b0ba11-92ea-4765-8eae-7d411ebfef0d	mujer_alerta_v1	2	\N	\N	2	19	t	2025-12-26 20:25:30.97884-06	2025-12-26 20:26:26.732888-06	2025-12-26 20:25:30.97884-06	Comentario opcional
8c9938e5-93ef-4641-ad3b-cd65023a8446	mujer_alerta_v1	1	\N	\N	2	22	t	2025-12-26 20:41:36.916176-06	2025-12-26 20:42:32.49386-06	2025-12-26 20:41:36.916176-06	Comentario opcional
5bf9065c-7a79-4c26-9c5c-d28648097ec7	mujer_alerta_v1	1	\N	\N	2	22	t	2026-01-04 23:14:04.766157-06	\N	2026-01-04 23:14:04.766157-06	\N
06e21c23-d70e-4a3f-9f27-070200994f61	mujer_alerta_v1	1	\N	\N	2	22	t	2026-01-04 23:25:30.736376-06	\N	2026-01-04 23:25:30.736376-06	\N
\.


--
-- Data for Name: generos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.generos (id, clave, etiqueta, descripcion, activo) FROM stdin;
1	mujer	Mujer	Persona que se identifica como mujer	t
2	hombre	Hombre	Persona que se identifica como hombre	t
3	no_binaria	Persona no binaria	Persona cuya identidad no se inscribe en el binario mujer/hombre	t
4	trans	Persona trans	Persona cuya identidad de género no coincide con el sexo asignado al nacer	t
5	agenero	Persona agénero	Persona que no se identifica con ningún género	t
6	genero_fluido	Género fluido	Persona cuya identidad de género puede variar	t
7	prefiero_no_decir	Prefiero no decir	La persona decide no especificar su identidad de género	t
8	otra_identidad	Otra identidad	Identidad de género no listada	t
\.


--
-- Data for Name: respuestas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.respuestas (id, encuesta_id, pregunta_id, dimension, valor, created_at) FROM stdin;
193	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P1	frecuencia	3	2025-12-22 23:32:01.197543-06
194	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P1	normalidad	3	2025-12-22 23:32:01.197543-06
195	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P1	gravedad	3	2025-12-22 23:32:01.197543-06
196	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P2	frecuencia	3	2025-12-22 23:32:01.197543-06
197	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P2	normalidad	3	2025-12-22 23:32:01.197543-06
198	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P2	gravedad	3	2025-12-22 23:32:01.197543-06
199	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P3	frecuencia	3	2025-12-22 23:32:01.197543-06
200	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P3	normalidad	3	2025-12-22 23:32:01.197543-06
201	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P3	gravedad	3	2025-12-22 23:32:01.197543-06
202	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P4	frecuencia	3	2025-12-22 23:32:01.197543-06
203	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P4	normalidad	3	2025-12-22 23:32:01.197543-06
204	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P4	gravedad	3	2025-12-22 23:32:01.197543-06
205	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P5	frecuencia	3	2025-12-22 23:32:01.197543-06
206	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P5	normalidad	3	2025-12-22 23:32:01.197543-06
207	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P5	gravedad	3	2025-12-22 23:32:01.197543-06
208	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P6	frecuencia	3	2025-12-22 23:32:01.197543-06
209	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P6	normalidad	3	2025-12-22 23:32:01.197543-06
210	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P6	gravedad	3	2025-12-22 23:32:01.197543-06
211	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P7	frecuencia	3	2025-12-22 23:32:01.197543-06
212	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P7	normalidad	3	2025-12-22 23:32:01.197543-06
213	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P7	gravedad	3	2025-12-22 23:32:01.197543-06
214	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P8	frecuencia	3	2025-12-22 23:32:01.197543-06
215	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P8	normalidad	3	2025-12-22 23:32:01.197543-06
216	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P8	gravedad	3	2025-12-22 23:32:01.197543-06
217	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P9	frecuencia	3	2025-12-22 23:32:01.197543-06
218	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P9	normalidad	3	2025-12-22 23:32:01.197543-06
219	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P9	gravedad	3	2025-12-22 23:32:01.197543-06
220	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P10	frecuencia	3	2025-12-22 23:32:01.197543-06
221	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P10	normalidad	3	2025-12-22 23:32:01.197543-06
222	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P10	gravedad	3	2025-12-22 23:32:01.197543-06
223	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P11	frecuencia	3	2025-12-22 23:32:01.197543-06
224	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P11	normalidad	3	2025-12-22 23:32:01.197543-06
225	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P11	gravedad	3	2025-12-22 23:32:01.197543-06
226	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P12	frecuencia	3	2025-12-22 23:32:01.197543-06
227	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P12	normalidad	3	2025-12-22 23:32:01.197543-06
228	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P12	gravedad	3	2025-12-22 23:32:01.197543-06
229	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P13	frecuencia	3	2025-12-22 23:32:01.197543-06
230	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P13	normalidad	3	2025-12-22 23:32:01.197543-06
231	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P13	gravedad	3	2025-12-22 23:32:01.197543-06
232	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P14	frecuencia	3	2025-12-22 23:32:01.197543-06
233	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P14	normalidad	3	2025-12-22 23:32:01.197543-06
234	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P14	gravedad	3	2025-12-22 23:32:01.197543-06
235	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P15	frecuencia	3	2025-12-22 23:32:01.197543-06
236	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P15	normalidad	3	2025-12-22 23:32:01.197543-06
237	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P15	gravedad	3	2025-12-22 23:32:01.197543-06
238	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P16	frecuencia	3	2025-12-22 23:32:01.197543-06
239	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P16	normalidad	3	2025-12-22 23:32:01.197543-06
240	0c195731-23e4-4b51-a8fb-ccc2341c89f4	P16	gravedad	3	2025-12-22 23:32:01.197543-06
241	5ed565bc-991e-430e-877f-63f38ec7765e	P1	frecuencia	5	2025-12-22 23:33:25.293893-06
242	5ed565bc-991e-430e-877f-63f38ec7765e	P1	normalidad	5	2025-12-22 23:33:25.293893-06
243	5ed565bc-991e-430e-877f-63f38ec7765e	P1	gravedad	5	2025-12-22 23:33:25.293893-06
244	5ed565bc-991e-430e-877f-63f38ec7765e	P2	frecuencia	5	2025-12-22 23:33:25.293893-06
245	5ed565bc-991e-430e-877f-63f38ec7765e	P2	normalidad	5	2025-12-22 23:33:25.293893-06
246	5ed565bc-991e-430e-877f-63f38ec7765e	P2	gravedad	5	2025-12-22 23:33:25.293893-06
247	5ed565bc-991e-430e-877f-63f38ec7765e	P3	frecuencia	5	2025-12-22 23:33:25.293893-06
248	5ed565bc-991e-430e-877f-63f38ec7765e	P3	normalidad	5	2025-12-22 23:33:25.293893-06
249	5ed565bc-991e-430e-877f-63f38ec7765e	P3	gravedad	5	2025-12-22 23:33:25.293893-06
250	5ed565bc-991e-430e-877f-63f38ec7765e	P4	frecuencia	5	2025-12-22 23:33:25.293893-06
251	5ed565bc-991e-430e-877f-63f38ec7765e	P4	normalidad	5	2025-12-22 23:33:25.293893-06
252	5ed565bc-991e-430e-877f-63f38ec7765e	P4	gravedad	5	2025-12-22 23:33:25.293893-06
253	5ed565bc-991e-430e-877f-63f38ec7765e	P5	frecuencia	5	2025-12-22 23:33:25.293893-06
254	5ed565bc-991e-430e-877f-63f38ec7765e	P5	normalidad	5	2025-12-22 23:33:25.293893-06
255	5ed565bc-991e-430e-877f-63f38ec7765e	P5	gravedad	5	2025-12-22 23:33:25.293893-06
256	5ed565bc-991e-430e-877f-63f38ec7765e	P6	frecuencia	5	2025-12-22 23:33:25.293893-06
257	5ed565bc-991e-430e-877f-63f38ec7765e	P6	normalidad	5	2025-12-22 23:33:25.293893-06
258	5ed565bc-991e-430e-877f-63f38ec7765e	P6	gravedad	5	2025-12-22 23:33:25.293893-06
259	5ed565bc-991e-430e-877f-63f38ec7765e	P7	frecuencia	5	2025-12-22 23:33:25.293893-06
260	5ed565bc-991e-430e-877f-63f38ec7765e	P7	normalidad	5	2025-12-22 23:33:25.293893-06
261	5ed565bc-991e-430e-877f-63f38ec7765e	P7	gravedad	5	2025-12-22 23:33:25.293893-06
262	5ed565bc-991e-430e-877f-63f38ec7765e	P8	frecuencia	5	2025-12-22 23:33:25.293893-06
263	5ed565bc-991e-430e-877f-63f38ec7765e	P8	normalidad	5	2025-12-22 23:33:25.293893-06
264	5ed565bc-991e-430e-877f-63f38ec7765e	P8	gravedad	5	2025-12-22 23:33:25.293893-06
265	5ed565bc-991e-430e-877f-63f38ec7765e	P9	frecuencia	5	2025-12-22 23:33:25.293893-06
266	5ed565bc-991e-430e-877f-63f38ec7765e	P9	normalidad	5	2025-12-22 23:33:25.293893-06
267	5ed565bc-991e-430e-877f-63f38ec7765e	P9	gravedad	5	2025-12-22 23:33:25.293893-06
268	5ed565bc-991e-430e-877f-63f38ec7765e	P10	frecuencia	5	2025-12-22 23:33:25.293893-06
269	5ed565bc-991e-430e-877f-63f38ec7765e	P10	normalidad	5	2025-12-22 23:33:25.293893-06
270	5ed565bc-991e-430e-877f-63f38ec7765e	P10	gravedad	5	2025-12-22 23:33:25.293893-06
271	5ed565bc-991e-430e-877f-63f38ec7765e	P11	frecuencia	5	2025-12-22 23:33:25.293893-06
272	5ed565bc-991e-430e-877f-63f38ec7765e	P11	normalidad	5	2025-12-22 23:33:25.293893-06
273	5ed565bc-991e-430e-877f-63f38ec7765e	P11	gravedad	5	2025-12-22 23:33:25.293893-06
274	5ed565bc-991e-430e-877f-63f38ec7765e	P12	frecuencia	5	2025-12-22 23:33:25.293893-06
275	5ed565bc-991e-430e-877f-63f38ec7765e	P12	normalidad	5	2025-12-22 23:33:25.293893-06
276	5ed565bc-991e-430e-877f-63f38ec7765e	P12	gravedad	5	2025-12-22 23:33:25.293893-06
277	5ed565bc-991e-430e-877f-63f38ec7765e	P13	frecuencia	5	2025-12-22 23:33:25.293893-06
278	5ed565bc-991e-430e-877f-63f38ec7765e	P13	normalidad	5	2025-12-22 23:33:25.293893-06
279	5ed565bc-991e-430e-877f-63f38ec7765e	P13	gravedad	5	2025-12-22 23:33:25.293893-06
280	5ed565bc-991e-430e-877f-63f38ec7765e	P14	frecuencia	5	2025-12-22 23:33:25.293893-06
281	5ed565bc-991e-430e-877f-63f38ec7765e	P14	normalidad	5	2025-12-22 23:33:25.293893-06
282	5ed565bc-991e-430e-877f-63f38ec7765e	P14	gravedad	5	2025-12-22 23:33:25.293893-06
283	5ed565bc-991e-430e-877f-63f38ec7765e	P15	frecuencia	5	2025-12-22 23:33:25.293893-06
284	5ed565bc-991e-430e-877f-63f38ec7765e	P15	normalidad	5	2025-12-22 23:33:25.293893-06
285	5ed565bc-991e-430e-877f-63f38ec7765e	P15	gravedad	5	2025-12-22 23:33:25.293893-06
286	5ed565bc-991e-430e-877f-63f38ec7765e	P16	frecuencia	5	2025-12-22 23:33:25.293893-06
287	5ed565bc-991e-430e-877f-63f38ec7765e	P16	normalidad	5	2025-12-22 23:33:25.293893-06
288	5ed565bc-991e-430e-877f-63f38ec7765e	P16	gravedad	5	2025-12-22 23:33:25.293893-06
289	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P1	frecuencia	1	2025-12-22 23:49:14.625122-06
290	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P1	normalidad	3	2025-12-22 23:49:14.625122-06
291	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P1	gravedad	2	2025-12-22 23:49:14.625122-06
292	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P2	frecuencia	2	2025-12-22 23:49:14.625122-06
293	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P2	normalidad	4	2025-12-22 23:49:14.625122-06
294	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P2	gravedad	3	2025-12-22 23:49:14.625122-06
295	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P3	frecuencia	4	2025-12-22 23:49:14.625122-06
296	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P3	normalidad	3	2025-12-22 23:49:14.625122-06
297	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P3	gravedad	2	2025-12-22 23:49:14.625122-06
298	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P4	frecuencia	3	2025-12-22 23:49:14.625122-06
299	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P4	normalidad	4	2025-12-22 23:49:14.625122-06
300	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P4	gravedad	3	2025-12-22 23:49:14.625122-06
301	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P5	frecuencia	1	2025-12-22 23:49:14.625122-06
302	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P5	normalidad	4	2025-12-22 23:49:14.625122-06
303	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P5	gravedad	3	2025-12-22 23:49:14.625122-06
304	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P6	frecuencia	1	2025-12-22 23:49:14.625122-06
305	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P6	normalidad	2	2025-12-22 23:49:14.625122-06
306	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P6	gravedad	5	2025-12-22 23:49:14.625122-06
307	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P7	frecuencia	2	2025-12-22 23:49:14.625122-06
308	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P7	normalidad	3	2025-12-22 23:49:14.625122-06
309	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P7	gravedad	2	2025-12-22 23:49:14.625122-06
310	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P8	frecuencia	3	2025-12-22 23:49:14.625122-06
311	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P8	normalidad	1	2025-12-22 23:49:14.625122-06
312	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P8	gravedad	4	2025-12-22 23:49:14.625122-06
313	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P9	frecuencia	4	2025-12-22 23:49:14.625122-06
314	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P9	normalidad	3	2025-12-22 23:49:14.625122-06
315	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P9	gravedad	2	2025-12-22 23:49:14.625122-06
316	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P10	frecuencia	3	2025-12-22 23:49:14.625122-06
317	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P10	normalidad	4	2025-12-22 23:49:14.625122-06
318	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P10	gravedad	3	2025-12-22 23:49:14.625122-06
319	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P11	frecuencia	2	2025-12-22 23:49:14.625122-06
320	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P11	normalidad	4	2025-12-22 23:49:14.625122-06
321	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P11	gravedad	3	2025-12-22 23:49:14.625122-06
322	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P12	frecuencia	2	2025-12-22 23:49:14.625122-06
323	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P12	normalidad	4	2025-12-22 23:49:14.625122-06
324	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P12	gravedad	2	2025-12-22 23:49:14.625122-06
325	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P13	frecuencia	2	2025-12-22 23:49:14.625122-06
326	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P13	normalidad	3	2025-12-22 23:49:14.625122-06
327	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P13	gravedad	3	2025-12-22 23:49:14.625122-06
328	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P14	frecuencia	3	2025-12-22 23:49:14.625122-06
329	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P14	normalidad	3	2025-12-22 23:49:14.625122-06
330	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P14	gravedad	4	2025-12-22 23:49:14.625122-06
331	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P15	frecuencia	3	2025-12-22 23:49:14.625122-06
332	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P15	normalidad	4	2025-12-22 23:49:14.625122-06
333	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P15	gravedad	2	2025-12-22 23:49:14.625122-06
334	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P16	frecuencia	3	2025-12-22 23:49:14.625122-06
335	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P16	normalidad	4	2025-12-22 23:49:14.625122-06
336	f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	P16	gravedad	2	2025-12-22 23:49:14.625122-06
337	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P1	frecuencia	2	2025-12-22 23:54:48.028419-06
338	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P1	normalidad	3	2025-12-22 23:54:48.028419-06
339	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P1	gravedad	2	2025-12-22 23:54:48.028419-06
340	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P2	frecuencia	3	2025-12-22 23:54:48.028419-06
341	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P2	normalidad	2	2025-12-22 23:54:48.028419-06
342	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P2	gravedad	3	2025-12-22 23:54:48.028419-06
343	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P3	frecuencia	2	2025-12-22 23:54:48.028419-06
344	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P3	normalidad	4	2025-12-22 23:54:48.028419-06
345	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P3	gravedad	2	2025-12-22 23:54:48.028419-06
346	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P4	frecuencia	3	2025-12-22 23:54:48.028419-06
347	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P4	normalidad	4	2025-12-22 23:54:48.028419-06
348	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P4	gravedad	5	2025-12-22 23:54:48.028419-06
349	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P5	frecuencia	3	2025-12-22 23:54:48.028419-06
350	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P5	normalidad	2	2025-12-22 23:54:48.028419-06
351	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P5	gravedad	1	2025-12-22 23:54:48.028419-06
352	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P6	frecuencia	2	2025-12-22 23:54:48.028419-06
353	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P6	normalidad	3	2025-12-22 23:54:48.028419-06
354	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P6	gravedad	3	2025-12-22 23:54:48.028419-06
355	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P7	frecuencia	1	2025-12-22 23:54:48.028419-06
356	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P7	normalidad	3	2025-12-22 23:54:48.028419-06
357	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P7	gravedad	3	2025-12-22 23:54:48.028419-06
358	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P8	frecuencia	1	2025-12-22 23:54:48.028419-06
359	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P8	normalidad	3	2025-12-22 23:54:48.028419-06
360	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P8	gravedad	4	2025-12-22 23:54:48.028419-06
361	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P9	frecuencia	1	2025-12-22 23:54:48.028419-06
362	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P9	normalidad	3	2025-12-22 23:54:48.028419-06
363	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P9	gravedad	3	2025-12-22 23:54:48.028419-06
364	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P10	frecuencia	1	2025-12-22 23:54:48.028419-06
365	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P10	normalidad	4	2025-12-22 23:54:48.028419-06
366	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P10	gravedad	4	2025-12-22 23:54:48.028419-06
367	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P11	frecuencia	2	2025-12-22 23:54:48.028419-06
368	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P11	normalidad	4	2025-12-22 23:54:48.028419-06
369	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P11	gravedad	3	2025-12-22 23:54:48.028419-06
370	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P12	frecuencia	2	2025-12-22 23:54:48.028419-06
371	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P12	normalidad	4	2025-12-22 23:54:48.028419-06
372	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P12	gravedad	3	2025-12-22 23:54:48.028419-06
373	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P13	frecuencia	2	2025-12-22 23:54:48.028419-06
374	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P13	normalidad	4	2025-12-22 23:54:48.028419-06
375	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P13	gravedad	3	2025-12-22 23:54:48.028419-06
376	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P14	frecuencia	1	2025-12-22 23:54:48.028419-06
377	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P14	normalidad	4	2025-12-22 23:54:48.028419-06
378	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P14	gravedad	3	2025-12-22 23:54:48.028419-06
379	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P15	frecuencia	1	2025-12-22 23:54:48.028419-06
380	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P15	normalidad	3	2025-12-22 23:54:48.028419-06
381	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P15	gravedad	3	2025-12-22 23:54:48.028419-06
382	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P16	frecuencia	3	2025-12-22 23:54:48.028419-06
383	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P16	normalidad	3	2025-12-22 23:54:48.028419-06
384	7131bcfd-fdf4-481c-8ddf-e9344efbed87	P16	gravedad	2	2025-12-22 23:54:48.028419-06
385	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P1	frecuencia	4	2025-12-22 23:58:08.527149-06
386	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P1	normalidad	2	2025-12-22 23:58:08.527149-06
387	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P1	gravedad	3	2025-12-22 23:58:08.527149-06
388	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P2	frecuencia	2	2025-12-22 23:58:08.527149-06
389	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P2	normalidad	4	2025-12-22 23:58:08.527149-06
390	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P2	gravedad	4	2025-12-22 23:58:08.527149-06
391	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P3	frecuencia	3	2025-12-22 23:58:08.527149-06
392	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P3	normalidad	2	2025-12-22 23:58:08.527149-06
393	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P3	gravedad	4	2025-12-22 23:58:08.527149-06
394	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P4	frecuencia	4	2025-12-22 23:58:08.527149-06
395	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P4	normalidad	4	2025-12-22 23:58:08.527149-06
396	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P4	gravedad	2	2025-12-22 23:58:08.527149-06
397	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P5	frecuencia	3	2025-12-22 23:58:08.527149-06
398	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P5	normalidad	4	2025-12-22 23:58:08.527149-06
399	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P5	gravedad	2	2025-12-22 23:58:08.527149-06
400	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P6	frecuencia	3	2025-12-22 23:58:08.527149-06
401	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P6	normalidad	4	2025-12-22 23:58:08.527149-06
402	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P6	gravedad	5	2025-12-22 23:58:08.527149-06
403	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P7	frecuencia	3	2025-12-22 23:58:08.527149-06
404	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P7	normalidad	4	2025-12-22 23:58:08.527149-06
405	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P7	gravedad	5	2025-12-22 23:58:08.527149-06
406	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P8	frecuencia	2	2025-12-22 23:58:08.527149-06
407	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P8	normalidad	4	2025-12-22 23:58:08.527149-06
408	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P8	gravedad	3	2025-12-22 23:58:08.527149-06
409	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P9	frecuencia	4	2025-12-22 23:58:08.527149-06
410	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P9	normalidad	3	2025-12-22 23:58:08.527149-06
411	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P9	gravedad	5	2025-12-22 23:58:08.527149-06
412	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P10	frecuencia	4	2025-12-22 23:58:08.527149-06
413	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P10	normalidad	4	2025-12-22 23:58:08.527149-06
414	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P10	gravedad	5	2025-12-22 23:58:08.527149-06
415	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P11	frecuencia	2	2025-12-22 23:58:08.527149-06
416	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P11	normalidad	4	2025-12-22 23:58:08.527149-06
417	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P11	gravedad	5	2025-12-22 23:58:08.527149-06
418	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P12	frecuencia	3	2025-12-22 23:58:08.527149-06
419	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P12	normalidad	2	2025-12-22 23:58:08.527149-06
420	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P12	gravedad	4	2025-12-22 23:58:08.527149-06
421	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P13	frecuencia	4	2025-12-22 23:58:08.527149-06
422	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P13	normalidad	4	2025-12-22 23:58:08.527149-06
423	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P13	gravedad	5	2025-12-22 23:58:08.527149-06
424	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P14	frecuencia	3	2025-12-22 23:58:08.527149-06
425	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P14	normalidad	4	2025-12-22 23:58:08.527149-06
426	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P14	gravedad	5	2025-12-22 23:58:08.527149-06
427	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P15	frecuencia	2	2025-12-22 23:58:08.527149-06
428	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P15	normalidad	4	2025-12-22 23:58:08.527149-06
429	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P15	gravedad	5	2025-12-22 23:58:08.527149-06
430	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P16	frecuencia	2	2025-12-22 23:58:08.527149-06
431	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P16	normalidad	4	2025-12-22 23:58:08.527149-06
432	cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	P16	gravedad	5	2025-12-22 23:58:08.527149-06
433	8334e638-51c0-471c-8118-9b9cf55f1cbd	P1	frecuencia	1	2025-12-23 00:41:33.712948-06
434	8334e638-51c0-471c-8118-9b9cf55f1cbd	P1	normalidad	1	2025-12-23 00:41:33.712948-06
435	8334e638-51c0-471c-8118-9b9cf55f1cbd	P1	gravedad	1	2025-12-23 00:41:33.712948-06
436	8334e638-51c0-471c-8118-9b9cf55f1cbd	P2	frecuencia	1	2025-12-23 00:41:33.712948-06
437	8334e638-51c0-471c-8118-9b9cf55f1cbd	P2	normalidad	1	2025-12-23 00:41:33.712948-06
438	8334e638-51c0-471c-8118-9b9cf55f1cbd	P2	gravedad	1	2025-12-23 00:41:33.712948-06
439	8334e638-51c0-471c-8118-9b9cf55f1cbd	P3	frecuencia	2	2025-12-23 00:41:33.712948-06
440	8334e638-51c0-471c-8118-9b9cf55f1cbd	P3	normalidad	2	2025-12-23 00:41:33.712948-06
441	8334e638-51c0-471c-8118-9b9cf55f1cbd	P3	gravedad	2	2025-12-23 00:41:33.712948-06
442	8334e638-51c0-471c-8118-9b9cf55f1cbd	P4	frecuencia	3	2025-12-23 00:41:33.712948-06
443	8334e638-51c0-471c-8118-9b9cf55f1cbd	P4	normalidad	3	2025-12-23 00:41:33.712948-06
444	8334e638-51c0-471c-8118-9b9cf55f1cbd	P4	gravedad	3	2025-12-23 00:41:33.712948-06
445	8334e638-51c0-471c-8118-9b9cf55f1cbd	P5	frecuencia	4	2025-12-23 00:41:33.712948-06
446	8334e638-51c0-471c-8118-9b9cf55f1cbd	P5	normalidad	4	2025-12-23 00:41:33.712948-06
447	8334e638-51c0-471c-8118-9b9cf55f1cbd	P5	gravedad	4	2025-12-23 00:41:33.712948-06
448	8334e638-51c0-471c-8118-9b9cf55f1cbd	P6	frecuencia	5	2025-12-23 00:41:33.712948-06
449	8334e638-51c0-471c-8118-9b9cf55f1cbd	P6	normalidad	5	2025-12-23 00:41:33.712948-06
450	8334e638-51c0-471c-8118-9b9cf55f1cbd	P6	gravedad	5	2025-12-23 00:41:33.712948-06
451	8334e638-51c0-471c-8118-9b9cf55f1cbd	P7	frecuencia	1	2025-12-23 00:41:33.712948-06
452	8334e638-51c0-471c-8118-9b9cf55f1cbd	P7	normalidad	1	2025-12-23 00:41:33.712948-06
453	8334e638-51c0-471c-8118-9b9cf55f1cbd	P7	gravedad	1	2025-12-23 00:41:33.712948-06
454	8334e638-51c0-471c-8118-9b9cf55f1cbd	P8	frecuencia	1	2025-12-23 00:41:33.712948-06
455	8334e638-51c0-471c-8118-9b9cf55f1cbd	P8	normalidad	1	2025-12-23 00:41:33.712948-06
456	8334e638-51c0-471c-8118-9b9cf55f1cbd	P8	gravedad	1	2025-12-23 00:41:33.712948-06
457	8334e638-51c0-471c-8118-9b9cf55f1cbd	P9	frecuencia	1	2025-12-23 00:41:33.712948-06
458	8334e638-51c0-471c-8118-9b9cf55f1cbd	P9	normalidad	1	2025-12-23 00:41:33.712948-06
459	8334e638-51c0-471c-8118-9b9cf55f1cbd	P9	gravedad	1	2025-12-23 00:41:33.712948-06
460	8334e638-51c0-471c-8118-9b9cf55f1cbd	P10	frecuencia	1	2025-12-23 00:41:33.712948-06
461	8334e638-51c0-471c-8118-9b9cf55f1cbd	P10	normalidad	1	2025-12-23 00:41:33.712948-06
462	8334e638-51c0-471c-8118-9b9cf55f1cbd	P10	gravedad	1	2025-12-23 00:41:33.712948-06
463	8334e638-51c0-471c-8118-9b9cf55f1cbd	P11	frecuencia	3	2025-12-23 00:41:33.712948-06
464	8334e638-51c0-471c-8118-9b9cf55f1cbd	P11	normalidad	3	2025-12-23 00:41:33.712948-06
465	8334e638-51c0-471c-8118-9b9cf55f1cbd	P11	gravedad	3	2025-12-23 00:41:33.712948-06
466	8334e638-51c0-471c-8118-9b9cf55f1cbd	P12	frecuencia	3	2025-12-23 00:41:33.712948-06
467	8334e638-51c0-471c-8118-9b9cf55f1cbd	P12	normalidad	3	2025-12-23 00:41:33.712948-06
468	8334e638-51c0-471c-8118-9b9cf55f1cbd	P12	gravedad	3	2025-12-23 00:41:33.712948-06
469	8334e638-51c0-471c-8118-9b9cf55f1cbd	P13	frecuencia	1	2025-12-23 00:41:33.712948-06
470	8334e638-51c0-471c-8118-9b9cf55f1cbd	P13	normalidad	1	2025-12-23 00:41:33.712948-06
471	8334e638-51c0-471c-8118-9b9cf55f1cbd	P13	gravedad	1	2025-12-23 00:41:33.712948-06
472	8334e638-51c0-471c-8118-9b9cf55f1cbd	P14	frecuencia	5	2025-12-23 00:41:33.712948-06
473	8334e638-51c0-471c-8118-9b9cf55f1cbd	P14	normalidad	5	2025-12-23 00:41:33.712948-06
474	8334e638-51c0-471c-8118-9b9cf55f1cbd	P14	gravedad	5	2025-12-23 00:41:33.712948-06
475	8334e638-51c0-471c-8118-9b9cf55f1cbd	P15	frecuencia	5	2025-12-23 00:41:33.712948-06
476	8334e638-51c0-471c-8118-9b9cf55f1cbd	P15	normalidad	5	2025-12-23 00:41:33.712948-06
477	8334e638-51c0-471c-8118-9b9cf55f1cbd	P15	gravedad	5	2025-12-23 00:41:33.712948-06
478	8334e638-51c0-471c-8118-9b9cf55f1cbd	P16	frecuencia	1	2025-12-23 00:41:33.712948-06
479	8334e638-51c0-471c-8118-9b9cf55f1cbd	P16	normalidad	1	2025-12-23 00:41:33.712948-06
480	8334e638-51c0-471c-8118-9b9cf55f1cbd	P16	gravedad	1	2025-12-23 00:41:33.712948-06
481	a1ff5612-30c0-481d-af9b-2a563871869d	P1	frecuencia	5	2025-12-23 00:48:14.878206-06
482	a1ff5612-30c0-481d-af9b-2a563871869d	P1	normalidad	5	2025-12-23 00:48:14.878206-06
483	a1ff5612-30c0-481d-af9b-2a563871869d	P1	gravedad	5	2025-12-23 00:48:14.878206-06
484	a1ff5612-30c0-481d-af9b-2a563871869d	P2	frecuencia	5	2025-12-23 00:48:14.878206-06
485	a1ff5612-30c0-481d-af9b-2a563871869d	P2	normalidad	5	2025-12-23 00:48:14.878206-06
486	a1ff5612-30c0-481d-af9b-2a563871869d	P2	gravedad	5	2025-12-23 00:48:14.878206-06
487	a1ff5612-30c0-481d-af9b-2a563871869d	P3	frecuencia	5	2025-12-23 00:48:14.878206-06
488	a1ff5612-30c0-481d-af9b-2a563871869d	P3	normalidad	5	2025-12-23 00:48:14.878206-06
489	a1ff5612-30c0-481d-af9b-2a563871869d	P3	gravedad	5	2025-12-23 00:48:14.878206-06
490	a1ff5612-30c0-481d-af9b-2a563871869d	P4	frecuencia	5	2025-12-23 00:48:14.878206-06
491	a1ff5612-30c0-481d-af9b-2a563871869d	P4	normalidad	5	2025-12-23 00:48:14.878206-06
492	a1ff5612-30c0-481d-af9b-2a563871869d	P4	gravedad	5	2025-12-23 00:48:14.878206-06
493	a1ff5612-30c0-481d-af9b-2a563871869d	P5	frecuencia	1	2025-12-23 00:48:14.878206-06
494	a1ff5612-30c0-481d-af9b-2a563871869d	P5	normalidad	1	2025-12-23 00:48:14.878206-06
495	a1ff5612-30c0-481d-af9b-2a563871869d	P5	gravedad	1	2025-12-23 00:48:14.878206-06
496	a1ff5612-30c0-481d-af9b-2a563871869d	P6	frecuencia	1	2025-12-23 00:48:14.878206-06
497	a1ff5612-30c0-481d-af9b-2a563871869d	P6	normalidad	1	2025-12-23 00:48:14.878206-06
498	a1ff5612-30c0-481d-af9b-2a563871869d	P6	gravedad	1	2025-12-23 00:48:14.878206-06
499	a1ff5612-30c0-481d-af9b-2a563871869d	P7	frecuencia	1	2025-12-23 00:48:14.878206-06
500	a1ff5612-30c0-481d-af9b-2a563871869d	P7	normalidad	1	2025-12-23 00:48:14.878206-06
501	a1ff5612-30c0-481d-af9b-2a563871869d	P7	gravedad	1	2025-12-23 00:48:14.878206-06
502	a1ff5612-30c0-481d-af9b-2a563871869d	P8	frecuencia	1	2025-12-23 00:48:14.878206-06
503	a1ff5612-30c0-481d-af9b-2a563871869d	P8	normalidad	1	2025-12-23 00:48:14.878206-06
504	a1ff5612-30c0-481d-af9b-2a563871869d	P8	gravedad	1	2025-12-23 00:48:14.878206-06
505	a1ff5612-30c0-481d-af9b-2a563871869d	P9	frecuencia	1	2025-12-23 00:48:14.878206-06
506	a1ff5612-30c0-481d-af9b-2a563871869d	P9	normalidad	1	2025-12-23 00:48:14.878206-06
507	a1ff5612-30c0-481d-af9b-2a563871869d	P9	gravedad	1	2025-12-23 00:48:14.878206-06
508	a1ff5612-30c0-481d-af9b-2a563871869d	P10	frecuencia	5	2025-12-23 00:48:14.878206-06
509	a1ff5612-30c0-481d-af9b-2a563871869d	P10	normalidad	5	2025-12-23 00:48:14.878206-06
510	a1ff5612-30c0-481d-af9b-2a563871869d	P10	gravedad	5	2025-12-23 00:48:14.878206-06
511	a1ff5612-30c0-481d-af9b-2a563871869d	P11	frecuencia	5	2025-12-23 00:48:14.878206-06
512	a1ff5612-30c0-481d-af9b-2a563871869d	P11	normalidad	5	2025-12-23 00:48:14.878206-06
513	a1ff5612-30c0-481d-af9b-2a563871869d	P11	gravedad	5	2025-12-23 00:48:14.878206-06
514	a1ff5612-30c0-481d-af9b-2a563871869d	P12	frecuencia	5	2025-12-23 00:48:14.878206-06
515	a1ff5612-30c0-481d-af9b-2a563871869d	P12	normalidad	5	2025-12-23 00:48:14.878206-06
516	a1ff5612-30c0-481d-af9b-2a563871869d	P12	gravedad	5	2025-12-23 00:48:14.878206-06
517	a1ff5612-30c0-481d-af9b-2a563871869d	P13	frecuencia	5	2025-12-23 00:48:14.878206-06
518	a1ff5612-30c0-481d-af9b-2a563871869d	P13	normalidad	5	2025-12-23 00:48:14.878206-06
519	a1ff5612-30c0-481d-af9b-2a563871869d	P13	gravedad	5	2025-12-23 00:48:14.878206-06
520	a1ff5612-30c0-481d-af9b-2a563871869d	P14	frecuencia	5	2025-12-23 00:48:14.878206-06
521	a1ff5612-30c0-481d-af9b-2a563871869d	P14	normalidad	5	2025-12-23 00:48:14.878206-06
522	a1ff5612-30c0-481d-af9b-2a563871869d	P14	gravedad	5	2025-12-23 00:48:14.878206-06
523	a1ff5612-30c0-481d-af9b-2a563871869d	P15	frecuencia	5	2025-12-23 00:48:14.878206-06
524	a1ff5612-30c0-481d-af9b-2a563871869d	P15	normalidad	5	2025-12-23 00:48:14.878206-06
525	a1ff5612-30c0-481d-af9b-2a563871869d	P15	gravedad	5	2025-12-23 00:48:14.878206-06
526	a1ff5612-30c0-481d-af9b-2a563871869d	P16	frecuencia	1	2025-12-23 00:48:14.878206-06
527	a1ff5612-30c0-481d-af9b-2a563871869d	P16	normalidad	1	2025-12-23 00:48:14.878206-06
528	a1ff5612-30c0-481d-af9b-2a563871869d	P16	gravedad	1	2025-12-23 00:48:14.878206-06
577	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P1	frecuencia	1	2025-12-23 01:03:50.778484-06
578	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P1	normalidad	1	2025-12-23 01:03:50.778484-06
579	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P1	gravedad	1	2025-12-23 01:03:50.778484-06
580	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P2	frecuencia	1	2025-12-23 01:03:50.778484-06
581	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P2	normalidad	1	2025-12-23 01:03:50.778484-06
582	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P2	gravedad	1	2025-12-23 01:03:50.778484-06
583	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P3	frecuencia	1	2025-12-23 01:03:50.778484-06
584	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P3	normalidad	1	2025-12-23 01:03:50.778484-06
585	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P3	gravedad	1	2025-12-23 01:03:50.778484-06
586	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P4	frecuencia	4	2025-12-23 01:03:50.778484-06
587	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P4	normalidad	4	2025-12-23 01:03:50.778484-06
588	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P4	gravedad	4	2025-12-23 01:03:50.778484-06
589	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P5	frecuencia	5	2025-12-23 01:03:50.778484-06
590	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P5	normalidad	5	2025-12-23 01:03:50.778484-06
591	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P5	gravedad	5	2025-12-23 01:03:50.778484-06
592	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P6	frecuencia	1	2025-12-23 01:03:50.778484-06
593	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P6	normalidad	1	2025-12-23 01:03:50.778484-06
594	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P6	gravedad	1	2025-12-23 01:03:50.778484-06
595	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P7	frecuencia	5	2025-12-23 01:03:50.778484-06
596	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P7	normalidad	5	2025-12-23 01:03:50.778484-06
597	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P7	gravedad	5	2025-12-23 01:03:50.778484-06
598	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P8	frecuencia	1	2025-12-23 01:03:50.778484-06
599	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P8	normalidad	1	2025-12-23 01:03:50.778484-06
600	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P8	gravedad	1	2025-12-23 01:03:50.778484-06
601	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P9	frecuencia	5	2025-12-23 01:03:50.778484-06
602	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P9	normalidad	5	2025-12-23 01:03:50.778484-06
603	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P9	gravedad	5	2025-12-23 01:03:50.778484-06
604	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P10	frecuencia	1	2025-12-23 01:03:50.778484-06
605	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P10	normalidad	1	2025-12-23 01:03:50.778484-06
606	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P10	gravedad	1	2025-12-23 01:03:50.778484-06
607	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P11	frecuencia	5	2025-12-23 01:03:50.778484-06
608	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P11	normalidad	5	2025-12-23 01:03:50.778484-06
609	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P11	gravedad	5	2025-12-23 01:03:50.778484-06
610	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P12	frecuencia	5	2025-12-23 01:03:50.778484-06
611	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P12	normalidad	5	2025-12-23 01:03:50.778484-06
612	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P12	gravedad	5	2025-12-23 01:03:50.778484-06
613	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P13	frecuencia	1	2025-12-23 01:03:50.778484-06
614	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P13	normalidad	1	2025-12-23 01:03:50.778484-06
615	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P13	gravedad	1	2025-12-23 01:03:50.778484-06
616	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P14	frecuencia	3	2025-12-23 01:03:50.778484-06
617	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P14	normalidad	3	2025-12-23 01:03:50.778484-06
618	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P14	gravedad	3	2025-12-23 01:03:50.778484-06
619	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P15	frecuencia	5	2025-12-23 01:03:50.778484-06
620	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P15	normalidad	5	2025-12-23 01:03:50.778484-06
621	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P15	gravedad	5	2025-12-23 01:03:50.778484-06
622	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P16	frecuencia	5	2025-12-23 01:03:50.778484-06
623	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P16	normalidad	5	2025-12-23 01:03:50.778484-06
624	e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	P16	gravedad	5	2025-12-23 01:03:50.778484-06
625	2af03b0f-91a2-4c09-baaf-46ccd0749197	P1	frecuencia	1	2025-12-23 01:06:53.268235-06
626	2af03b0f-91a2-4c09-baaf-46ccd0749197	P1	normalidad	1	2025-12-23 01:06:53.268235-06
627	2af03b0f-91a2-4c09-baaf-46ccd0749197	P1	gravedad	3	2025-12-23 01:06:53.268235-06
628	2af03b0f-91a2-4c09-baaf-46ccd0749197	P2	frecuencia	2	2025-12-23 01:06:53.268235-06
629	2af03b0f-91a2-4c09-baaf-46ccd0749197	P2	normalidad	3	2025-12-23 01:06:53.268235-06
630	2af03b0f-91a2-4c09-baaf-46ccd0749197	P2	gravedad	2	2025-12-23 01:06:53.268235-06
631	2af03b0f-91a2-4c09-baaf-46ccd0749197	P3	frecuencia	3	2025-12-23 01:06:53.268235-06
632	2af03b0f-91a2-4c09-baaf-46ccd0749197	P3	normalidad	3	2025-12-23 01:06:53.268235-06
633	2af03b0f-91a2-4c09-baaf-46ccd0749197	P3	gravedad	5	2025-12-23 01:06:53.268235-06
634	2af03b0f-91a2-4c09-baaf-46ccd0749197	P4	frecuencia	3	2025-12-23 01:06:53.268235-06
635	2af03b0f-91a2-4c09-baaf-46ccd0749197	P4	normalidad	2	2025-12-23 01:06:53.268235-06
636	2af03b0f-91a2-4c09-baaf-46ccd0749197	P4	gravedad	4	2025-12-23 01:06:53.268235-06
637	2af03b0f-91a2-4c09-baaf-46ccd0749197	P5	frecuencia	4	2025-12-23 01:06:53.268235-06
638	2af03b0f-91a2-4c09-baaf-46ccd0749197	P5	normalidad	3	2025-12-23 01:06:53.268235-06
639	2af03b0f-91a2-4c09-baaf-46ccd0749197	P5	gravedad	3	2025-12-23 01:06:53.268235-06
640	2af03b0f-91a2-4c09-baaf-46ccd0749197	P6	frecuencia	3	2025-12-23 01:06:53.268235-06
641	2af03b0f-91a2-4c09-baaf-46ccd0749197	P6	normalidad	4	2025-12-23 01:06:53.268235-06
642	2af03b0f-91a2-4c09-baaf-46ccd0749197	P6	gravedad	5	2025-12-23 01:06:53.268235-06
643	2af03b0f-91a2-4c09-baaf-46ccd0749197	P7	frecuencia	2	2025-12-23 01:06:53.268235-06
644	2af03b0f-91a2-4c09-baaf-46ccd0749197	P7	normalidad	3	2025-12-23 01:06:53.268235-06
645	2af03b0f-91a2-4c09-baaf-46ccd0749197	P7	gravedad	4	2025-12-23 01:06:53.268235-06
646	2af03b0f-91a2-4c09-baaf-46ccd0749197	P8	frecuencia	4	2025-12-23 01:06:53.268235-06
647	2af03b0f-91a2-4c09-baaf-46ccd0749197	P8	normalidad	3	2025-12-23 01:06:53.268235-06
648	2af03b0f-91a2-4c09-baaf-46ccd0749197	P8	gravedad	5	2025-12-23 01:06:53.268235-06
649	2af03b0f-91a2-4c09-baaf-46ccd0749197	P9	frecuencia	3	2025-12-23 01:06:53.268235-06
650	2af03b0f-91a2-4c09-baaf-46ccd0749197	P9	normalidad	5	2025-12-23 01:06:53.268235-06
651	2af03b0f-91a2-4c09-baaf-46ccd0749197	P9	gravedad	5	2025-12-23 01:06:53.268235-06
652	2af03b0f-91a2-4c09-baaf-46ccd0749197	P10	frecuencia	3	2025-12-23 01:06:53.268235-06
653	2af03b0f-91a2-4c09-baaf-46ccd0749197	P10	normalidad	5	2025-12-23 01:06:53.268235-06
654	2af03b0f-91a2-4c09-baaf-46ccd0749197	P10	gravedad	3	2025-12-23 01:06:53.268235-06
655	2af03b0f-91a2-4c09-baaf-46ccd0749197	P11	frecuencia	3	2025-12-23 01:06:53.268235-06
656	2af03b0f-91a2-4c09-baaf-46ccd0749197	P11	normalidad	3	2025-12-23 01:06:53.268235-06
657	2af03b0f-91a2-4c09-baaf-46ccd0749197	P11	gravedad	3	2025-12-23 01:06:53.268235-06
658	2af03b0f-91a2-4c09-baaf-46ccd0749197	P12	frecuencia	4	2025-12-23 01:06:53.268235-06
659	2af03b0f-91a2-4c09-baaf-46ccd0749197	P12	normalidad	3	2025-12-23 01:06:53.268235-06
660	2af03b0f-91a2-4c09-baaf-46ccd0749197	P12	gravedad	4	2025-12-23 01:06:53.268235-06
661	2af03b0f-91a2-4c09-baaf-46ccd0749197	P13	frecuencia	3	2025-12-23 01:06:53.268235-06
662	2af03b0f-91a2-4c09-baaf-46ccd0749197	P13	normalidad	4	2025-12-23 01:06:53.268235-06
663	2af03b0f-91a2-4c09-baaf-46ccd0749197	P13	gravedad	4	2025-12-23 01:06:53.268235-06
664	2af03b0f-91a2-4c09-baaf-46ccd0749197	P14	frecuencia	4	2025-12-23 01:06:53.268235-06
665	2af03b0f-91a2-4c09-baaf-46ccd0749197	P14	normalidad	4	2025-12-23 01:06:53.268235-06
666	2af03b0f-91a2-4c09-baaf-46ccd0749197	P14	gravedad	4	2025-12-23 01:06:53.268235-06
667	2af03b0f-91a2-4c09-baaf-46ccd0749197	P15	frecuencia	3	2025-12-23 01:06:53.268235-06
668	2af03b0f-91a2-4c09-baaf-46ccd0749197	P15	normalidad	5	2025-12-23 01:06:53.268235-06
669	2af03b0f-91a2-4c09-baaf-46ccd0749197	P15	gravedad	5	2025-12-23 01:06:53.268235-06
670	2af03b0f-91a2-4c09-baaf-46ccd0749197	P16	frecuencia	4	2025-12-23 01:06:53.268235-06
671	2af03b0f-91a2-4c09-baaf-46ccd0749197	P16	normalidad	4	2025-12-23 01:06:53.268235-06
672	2af03b0f-91a2-4c09-baaf-46ccd0749197	P16	gravedad	5	2025-12-23 01:06:53.268235-06
673	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P1	frecuencia	3	2025-12-23 01:41:21.971579-06
674	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P1	normalidad	3	2025-12-23 01:41:21.971579-06
675	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P1	gravedad	3	2025-12-23 01:41:21.971579-06
676	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P2	frecuencia	4	2025-12-23 01:41:21.971579-06
677	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P2	normalidad	4	2025-12-23 01:41:21.971579-06
678	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P2	gravedad	4	2025-12-23 01:41:21.971579-06
679	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P3	frecuencia	3	2025-12-23 01:41:21.971579-06
680	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P3	normalidad	4	2025-12-23 01:41:21.971579-06
681	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P3	gravedad	3	2025-12-23 01:41:21.971579-06
682	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P4	frecuencia	4	2025-12-23 01:41:21.971579-06
683	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P4	normalidad	4	2025-12-23 01:41:21.971579-06
684	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P4	gravedad	4	2025-12-23 01:41:21.971579-06
685	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P5	frecuencia	5	2025-12-23 01:41:21.971579-06
686	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P5	normalidad	4	2025-12-23 01:41:21.971579-06
687	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P5	gravedad	4	2025-12-23 01:41:21.971579-06
688	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P6	frecuencia	3	2025-12-23 01:41:21.971579-06
689	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P6	normalidad	4	2025-12-23 01:41:21.971579-06
690	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P6	gravedad	5	2025-12-23 01:41:21.971579-06
691	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P7	frecuencia	4	2025-12-23 01:41:21.971579-06
692	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P7	normalidad	5	2025-12-23 01:41:21.971579-06
693	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P7	gravedad	5	2025-12-23 01:41:21.971579-06
694	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P8	frecuencia	5	2025-12-23 01:41:21.971579-06
695	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P8	normalidad	5	2025-12-23 01:41:21.971579-06
696	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P8	gravedad	5	2025-12-23 01:41:21.971579-06
697	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P9	frecuencia	4	2025-12-23 01:41:21.971579-06
698	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P9	normalidad	5	2025-12-23 01:41:21.971579-06
699	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P9	gravedad	4	2025-12-23 01:41:21.971579-06
700	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P10	frecuencia	5	2025-12-23 01:41:21.971579-06
701	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P10	normalidad	4	2025-12-23 01:41:21.971579-06
702	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P10	gravedad	4	2025-12-23 01:41:21.971579-06
703	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P11	frecuencia	4	2025-12-23 01:41:21.971579-06
704	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P11	normalidad	4	2025-12-23 01:41:21.971579-06
705	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P11	gravedad	4	2025-12-23 01:41:21.971579-06
706	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P12	frecuencia	3	2025-12-23 01:41:21.971579-06
707	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P12	normalidad	4	2025-12-23 01:41:21.971579-06
708	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P12	gravedad	4	2025-12-23 01:41:21.971579-06
709	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P13	frecuencia	4	2025-12-23 01:41:21.971579-06
710	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P13	normalidad	4	2025-12-23 01:41:21.971579-06
711	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P13	gravedad	4	2025-12-23 01:41:21.971579-06
712	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P14	frecuencia	4	2025-12-23 01:41:21.971579-06
713	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P14	normalidad	3	2025-12-23 01:41:21.971579-06
714	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P14	gravedad	4	2025-12-23 01:41:21.971579-06
715	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P15	frecuencia	4	2025-12-23 01:41:21.971579-06
716	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P15	normalidad	4	2025-12-23 01:41:21.971579-06
717	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P15	gravedad	4	2025-12-23 01:41:21.971579-06
718	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P16	frecuencia	4	2025-12-23 01:41:21.971579-06
719	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P16	normalidad	4	2025-12-23 01:41:21.971579-06
720	c9d3c582-4bc7-4e07-bb85-cf9097587be3	P16	gravedad	4	2025-12-23 01:41:21.971579-06
769	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P1	frecuencia	3	2025-12-23 02:14:51.744806-06
770	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P1	normalidad	3	2025-12-23 02:14:51.744806-06
771	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P1	gravedad	4	2025-12-23 02:14:51.744806-06
772	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P2	frecuencia	3	2025-12-23 02:14:51.744806-06
773	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P2	normalidad	3	2025-12-23 02:14:51.744806-06
774	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P2	gravedad	3	2025-12-23 02:14:51.744806-06
775	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P3	frecuencia	3	2025-12-23 02:14:51.744806-06
776	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P3	normalidad	3	2025-12-23 02:14:51.744806-06
777	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P3	gravedad	3	2025-12-23 02:14:51.744806-06
778	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P4	frecuencia	3	2025-12-23 02:14:51.744806-06
779	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P4	normalidad	3	2025-12-23 02:14:51.744806-06
780	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P4	gravedad	3	2025-12-23 02:14:51.744806-06
781	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P5	frecuencia	4	2025-12-23 02:14:51.744806-06
782	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P5	normalidad	3	2025-12-23 02:14:51.744806-06
783	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P5	gravedad	3	2025-12-23 02:14:51.744806-06
784	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P6	frecuencia	3	2025-12-23 02:14:51.744806-06
785	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P6	normalidad	3	2025-12-23 02:14:51.744806-06
786	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P6	gravedad	3	2025-12-23 02:14:51.744806-06
787	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P7	frecuencia	4	2025-12-23 02:14:51.744806-06
788	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P7	normalidad	3	2025-12-23 02:14:51.744806-06
789	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P7	gravedad	3	2025-12-23 02:14:51.744806-06
790	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P8	frecuencia	3	2025-12-23 02:14:51.744806-06
791	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P8	normalidad	3	2025-12-23 02:14:51.744806-06
792	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P8	gravedad	4	2025-12-23 02:14:51.744806-06
793	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P9	frecuencia	3	2025-12-23 02:14:51.744806-06
794	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P9	normalidad	3	2025-12-23 02:14:51.744806-06
795	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P9	gravedad	2	2025-12-23 02:14:51.744806-06
796	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P10	frecuencia	3	2025-12-23 02:14:51.744806-06
797	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P10	normalidad	3	2025-12-23 02:14:51.744806-06
798	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P10	gravedad	4	2025-12-23 02:14:51.744806-06
799	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P11	frecuencia	2	2025-12-23 02:14:51.744806-06
800	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P11	normalidad	3	2025-12-23 02:14:51.744806-06
801	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P11	gravedad	3	2025-12-23 02:14:51.744806-06
802	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P12	frecuencia	3	2025-12-23 02:14:51.744806-06
803	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P12	normalidad	3	2025-12-23 02:14:51.744806-06
804	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P12	gravedad	4	2025-12-23 02:14:51.744806-06
805	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P13	frecuencia	3	2025-12-23 02:14:51.744806-06
806	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P13	normalidad	3	2025-12-23 02:14:51.744806-06
807	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P13	gravedad	4	2025-12-23 02:14:51.744806-06
808	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P14	frecuencia	3	2025-12-23 02:14:51.744806-06
809	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P14	normalidad	2	2025-12-23 02:14:51.744806-06
810	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P14	gravedad	4	2025-12-23 02:14:51.744806-06
811	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P15	frecuencia	3	2025-12-23 02:14:51.744806-06
812	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P15	normalidad	4	2025-12-23 02:14:51.744806-06
813	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P15	gravedad	3	2025-12-23 02:14:51.744806-06
814	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P16	frecuencia	3	2025-12-23 02:14:51.744806-06
815	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P16	normalidad	3	2025-12-23 02:14:51.744806-06
816	6e02bcfc-e3a1-4cae-9773-69dfef549f41	P16	gravedad	4	2025-12-23 02:14:51.744806-06
865	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P1	frecuencia	3	2025-12-23 02:28:39.529308-06
866	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P1	normalidad	3	2025-12-23 02:28:39.529308-06
867	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P1	gravedad	4	2025-12-23 02:28:39.529308-06
868	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P2	frecuencia	3	2025-12-23 02:28:39.529308-06
869	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P2	normalidad	3	2025-12-23 02:28:39.529308-06
870	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P2	gravedad	3	2025-12-23 02:28:39.529308-06
871	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P3	frecuencia	4	2025-12-23 02:28:39.529308-06
872	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P3	normalidad	4	2025-12-23 02:28:39.529308-06
873	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P3	gravedad	4	2025-12-23 02:28:39.529308-06
874	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P4	frecuencia	3	2025-12-23 02:28:39.529308-06
875	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P4	normalidad	3	2025-12-23 02:28:39.529308-06
876	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P4	gravedad	4	2025-12-23 02:28:39.529308-06
877	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P5	frecuencia	3	2025-12-23 02:28:39.529308-06
878	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P5	normalidad	3	2025-12-23 02:28:39.529308-06
879	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P5	gravedad	4	2025-12-23 02:28:39.529308-06
880	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P6	frecuencia	3	2025-12-23 02:28:39.529308-06
881	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P6	normalidad	4	2025-12-23 02:28:39.529308-06
882	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P6	gravedad	4	2025-12-23 02:28:39.529308-06
883	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P7	frecuencia	3	2025-12-23 02:28:39.529308-06
884	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P7	normalidad	4	2025-12-23 02:28:39.529308-06
885	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P7	gravedad	4	2025-12-23 02:28:39.529308-06
886	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P8	frecuencia	3	2025-12-23 02:28:39.529308-06
887	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P8	normalidad	4	2025-12-23 02:28:39.529308-06
888	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P8	gravedad	4	2025-12-23 02:28:39.529308-06
889	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P9	frecuencia	4	2025-12-23 02:28:39.529308-06
890	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P9	normalidad	3	2025-12-23 02:28:39.529308-06
891	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P9	gravedad	3	2025-12-23 02:28:39.529308-06
892	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P10	frecuencia	4	2025-12-23 02:28:39.529308-06
893	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P10	normalidad	3	2025-12-23 02:28:39.529308-06
894	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P10	gravedad	3	2025-12-23 02:28:39.529308-06
895	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P11	frecuencia	3	2025-12-23 02:28:39.529308-06
896	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P11	normalidad	3	2025-12-23 02:28:39.529308-06
897	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P11	gravedad	4	2025-12-23 02:28:39.529308-06
898	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P12	frecuencia	3	2025-12-23 02:28:39.529308-06
899	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P12	normalidad	2	2025-12-23 02:28:39.529308-06
900	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P12	gravedad	4	2025-12-23 02:28:39.529308-06
901	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P13	frecuencia	3	2025-12-23 02:28:39.529308-06
902	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P13	normalidad	2	2025-12-23 02:28:39.529308-06
903	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P13	gravedad	4	2025-12-23 02:28:39.529308-06
904	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P14	frecuencia	4	2025-12-23 02:28:39.529308-06
905	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P14	normalidad	3	2025-12-23 02:28:39.529308-06
906	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P14	gravedad	4	2025-12-23 02:28:39.529308-06
907	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P15	frecuencia	4	2025-12-23 02:28:39.529308-06
908	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P15	normalidad	4	2025-12-23 02:28:39.529308-06
909	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P15	gravedad	4	2025-12-23 02:28:39.529308-06
910	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P16	frecuencia	4	2025-12-23 02:28:39.529308-06
911	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P16	normalidad	4	2025-12-23 02:28:39.529308-06
912	9ee4b8c8-b41d-475d-930c-2f83b32c4261	P16	gravedad	4	2025-12-23 02:28:39.529308-06
961	48f326d0-71e0-45f5-984e-77fb81133b9d	P1	frecuencia	4	2025-12-23 02:44:28.950791-06
962	48f326d0-71e0-45f5-984e-77fb81133b9d	P1	normalidad	4	2025-12-23 02:44:28.950791-06
963	48f326d0-71e0-45f5-984e-77fb81133b9d	P1	gravedad	2	2025-12-23 02:44:28.950791-06
964	48f326d0-71e0-45f5-984e-77fb81133b9d	P2	frecuencia	4	2025-12-23 02:44:28.950791-06
965	48f326d0-71e0-45f5-984e-77fb81133b9d	P2	normalidad	3	2025-12-23 02:44:28.950791-06
966	48f326d0-71e0-45f5-984e-77fb81133b9d	P2	gravedad	2	2025-12-23 02:44:28.950791-06
967	48f326d0-71e0-45f5-984e-77fb81133b9d	P3	frecuencia	4	2025-12-23 02:44:28.950791-06
968	48f326d0-71e0-45f5-984e-77fb81133b9d	P3	normalidad	4	2025-12-23 02:44:28.950791-06
969	48f326d0-71e0-45f5-984e-77fb81133b9d	P3	gravedad	3	2025-12-23 02:44:28.950791-06
970	48f326d0-71e0-45f5-984e-77fb81133b9d	P4	frecuencia	4	2025-12-23 02:44:28.950791-06
971	48f326d0-71e0-45f5-984e-77fb81133b9d	P4	normalidad	3	2025-12-23 02:44:28.950791-06
972	48f326d0-71e0-45f5-984e-77fb81133b9d	P4	gravedad	4	2025-12-23 02:44:28.950791-06
973	48f326d0-71e0-45f5-984e-77fb81133b9d	P5	frecuencia	4	2025-12-23 02:44:28.950791-06
974	48f326d0-71e0-45f5-984e-77fb81133b9d	P5	normalidad	4	2025-12-23 02:44:28.950791-06
975	48f326d0-71e0-45f5-984e-77fb81133b9d	P5	gravedad	3	2025-12-23 02:44:28.950791-06
976	48f326d0-71e0-45f5-984e-77fb81133b9d	P6	frecuencia	3	2025-12-23 02:44:28.950791-06
977	48f326d0-71e0-45f5-984e-77fb81133b9d	P6	normalidad	5	2025-12-23 02:44:28.950791-06
978	48f326d0-71e0-45f5-984e-77fb81133b9d	P6	gravedad	4	2025-12-23 02:44:28.950791-06
979	48f326d0-71e0-45f5-984e-77fb81133b9d	P7	frecuencia	3	2025-12-23 02:44:28.950791-06
980	48f326d0-71e0-45f5-984e-77fb81133b9d	P7	normalidad	3	2025-12-23 02:44:28.950791-06
981	48f326d0-71e0-45f5-984e-77fb81133b9d	P7	gravedad	5	2025-12-23 02:44:28.950791-06
982	48f326d0-71e0-45f5-984e-77fb81133b9d	P8	frecuencia	4	2025-12-23 02:44:28.950791-06
983	48f326d0-71e0-45f5-984e-77fb81133b9d	P8	normalidad	3	2025-12-23 02:44:28.950791-06
984	48f326d0-71e0-45f5-984e-77fb81133b9d	P8	gravedad	5	2025-12-23 02:44:28.950791-06
985	48f326d0-71e0-45f5-984e-77fb81133b9d	P9	frecuencia	3	2025-12-23 02:44:28.950791-06
986	48f326d0-71e0-45f5-984e-77fb81133b9d	P9	normalidad	4	2025-12-23 02:44:28.950791-06
987	48f326d0-71e0-45f5-984e-77fb81133b9d	P9	gravedad	3	2025-12-23 02:44:28.950791-06
988	48f326d0-71e0-45f5-984e-77fb81133b9d	P10	frecuencia	3	2025-12-23 02:44:28.950791-06
989	48f326d0-71e0-45f5-984e-77fb81133b9d	P10	normalidad	3	2025-12-23 02:44:28.950791-06
990	48f326d0-71e0-45f5-984e-77fb81133b9d	P10	gravedad	4	2025-12-23 02:44:28.950791-06
991	48f326d0-71e0-45f5-984e-77fb81133b9d	P11	frecuencia	4	2025-12-23 02:44:28.950791-06
992	48f326d0-71e0-45f5-984e-77fb81133b9d	P11	normalidad	3	2025-12-23 02:44:28.950791-06
993	48f326d0-71e0-45f5-984e-77fb81133b9d	P11	gravedad	3	2025-12-23 02:44:28.950791-06
994	48f326d0-71e0-45f5-984e-77fb81133b9d	P12	frecuencia	4	2025-12-23 02:44:28.950791-06
995	48f326d0-71e0-45f5-984e-77fb81133b9d	P12	normalidad	3	2025-12-23 02:44:28.950791-06
996	48f326d0-71e0-45f5-984e-77fb81133b9d	P12	gravedad	4	2025-12-23 02:44:28.950791-06
997	48f326d0-71e0-45f5-984e-77fb81133b9d	P13	frecuencia	3	2025-12-23 02:44:28.950791-06
998	48f326d0-71e0-45f5-984e-77fb81133b9d	P13	normalidad	4	2025-12-23 02:44:28.950791-06
999	48f326d0-71e0-45f5-984e-77fb81133b9d	P13	gravedad	3	2025-12-23 02:44:28.950791-06
1000	48f326d0-71e0-45f5-984e-77fb81133b9d	P14	frecuencia	5	2025-12-23 02:44:28.950791-06
1001	48f326d0-71e0-45f5-984e-77fb81133b9d	P14	normalidad	5	2025-12-23 02:44:28.950791-06
1002	48f326d0-71e0-45f5-984e-77fb81133b9d	P14	gravedad	4	2025-12-23 02:44:28.950791-06
1003	48f326d0-71e0-45f5-984e-77fb81133b9d	P15	frecuencia	5	2025-12-23 02:44:28.950791-06
1004	48f326d0-71e0-45f5-984e-77fb81133b9d	P15	normalidad	4	2025-12-23 02:44:28.950791-06
1005	48f326d0-71e0-45f5-984e-77fb81133b9d	P15	gravedad	4	2025-12-23 02:44:28.950791-06
1006	48f326d0-71e0-45f5-984e-77fb81133b9d	P16	frecuencia	4	2025-12-23 02:44:28.950791-06
1007	48f326d0-71e0-45f5-984e-77fb81133b9d	P16	normalidad	4	2025-12-23 02:44:28.950791-06
1008	48f326d0-71e0-45f5-984e-77fb81133b9d	P16	gravedad	4	2025-12-23 02:44:28.950791-06
1009	56222357-bef0-40db-9c3b-b2e93520fc01	P1	frecuencia	3	2025-12-23 16:00:19.380805-06
1010	56222357-bef0-40db-9c3b-b2e93520fc01	P1	normalidad	3	2025-12-23 16:00:19.380805-06
1011	56222357-bef0-40db-9c3b-b2e93520fc01	P1	gravedad	4	2025-12-23 16:00:19.380805-06
1012	56222357-bef0-40db-9c3b-b2e93520fc01	P2	frecuencia	3	2025-12-23 16:00:19.380805-06
1013	56222357-bef0-40db-9c3b-b2e93520fc01	P2	normalidad	4	2025-12-23 16:00:19.380805-06
1014	56222357-bef0-40db-9c3b-b2e93520fc01	P2	gravedad	3	2025-12-23 16:00:19.380805-06
1015	56222357-bef0-40db-9c3b-b2e93520fc01	P3	frecuencia	3	2025-12-23 16:00:19.380805-06
1016	56222357-bef0-40db-9c3b-b2e93520fc01	P3	normalidad	3	2025-12-23 16:00:19.380805-06
1017	56222357-bef0-40db-9c3b-b2e93520fc01	P3	gravedad	3	2025-12-23 16:00:19.380805-06
1018	56222357-bef0-40db-9c3b-b2e93520fc01	P4	frecuencia	3	2025-12-23 16:00:19.380805-06
1019	56222357-bef0-40db-9c3b-b2e93520fc01	P4	normalidad	3	2025-12-23 16:00:19.380805-06
1020	56222357-bef0-40db-9c3b-b2e93520fc01	P4	gravedad	4	2025-12-23 16:00:19.380805-06
1021	56222357-bef0-40db-9c3b-b2e93520fc01	P5	frecuencia	2	2025-12-23 16:00:19.380805-06
1022	56222357-bef0-40db-9c3b-b2e93520fc01	P5	normalidad	4	2025-12-23 16:00:19.380805-06
1023	56222357-bef0-40db-9c3b-b2e93520fc01	P5	gravedad	4	2025-12-23 16:00:19.380805-06
1024	56222357-bef0-40db-9c3b-b2e93520fc01	P6	frecuencia	3	2025-12-23 16:00:19.380805-06
1025	56222357-bef0-40db-9c3b-b2e93520fc01	P6	normalidad	4	2025-12-23 16:00:19.380805-06
1026	56222357-bef0-40db-9c3b-b2e93520fc01	P6	gravedad	4	2025-12-23 16:00:19.380805-06
1027	56222357-bef0-40db-9c3b-b2e93520fc01	P7	frecuencia	5	2025-12-23 16:00:19.380805-06
1028	56222357-bef0-40db-9c3b-b2e93520fc01	P7	normalidad	4	2025-12-23 16:00:19.380805-06
1029	56222357-bef0-40db-9c3b-b2e93520fc01	P7	gravedad	4	2025-12-23 16:00:19.380805-06
1030	56222357-bef0-40db-9c3b-b2e93520fc01	P8	frecuencia	4	2025-12-23 16:00:19.380805-06
1031	56222357-bef0-40db-9c3b-b2e93520fc01	P8	normalidad	5	2025-12-23 16:00:19.380805-06
1032	56222357-bef0-40db-9c3b-b2e93520fc01	P8	gravedad	5	2025-12-23 16:00:19.380805-06
1033	56222357-bef0-40db-9c3b-b2e93520fc01	P9	frecuencia	3	2025-12-23 16:00:19.380805-06
1034	56222357-bef0-40db-9c3b-b2e93520fc01	P9	normalidad	4	2025-12-23 16:00:19.380805-06
1035	56222357-bef0-40db-9c3b-b2e93520fc01	P9	gravedad	5	2025-12-23 16:00:19.380805-06
1036	56222357-bef0-40db-9c3b-b2e93520fc01	P10	frecuencia	3	2025-12-23 16:00:19.380805-06
1037	56222357-bef0-40db-9c3b-b2e93520fc01	P10	normalidad	4	2025-12-23 16:00:19.380805-06
1038	56222357-bef0-40db-9c3b-b2e93520fc01	P10	gravedad	4	2025-12-23 16:00:19.380805-06
1039	56222357-bef0-40db-9c3b-b2e93520fc01	P11	frecuencia	4	2025-12-23 16:00:19.380805-06
1040	56222357-bef0-40db-9c3b-b2e93520fc01	P11	normalidad	4	2025-12-23 16:00:19.380805-06
1041	56222357-bef0-40db-9c3b-b2e93520fc01	P11	gravedad	5	2025-12-23 16:00:19.380805-06
1042	56222357-bef0-40db-9c3b-b2e93520fc01	P12	frecuencia	4	2025-12-23 16:00:19.380805-06
1043	56222357-bef0-40db-9c3b-b2e93520fc01	P12	normalidad	5	2025-12-23 16:00:19.380805-06
1044	56222357-bef0-40db-9c3b-b2e93520fc01	P12	gravedad	5	2025-12-23 16:00:19.380805-06
1045	56222357-bef0-40db-9c3b-b2e93520fc01	P13	frecuencia	5	2025-12-23 16:00:19.380805-06
1046	56222357-bef0-40db-9c3b-b2e93520fc01	P13	normalidad	4	2025-12-23 16:00:19.380805-06
1047	56222357-bef0-40db-9c3b-b2e93520fc01	P13	gravedad	5	2025-12-23 16:00:19.380805-06
1048	56222357-bef0-40db-9c3b-b2e93520fc01	P14	frecuencia	4	2025-12-23 16:00:19.380805-06
1049	56222357-bef0-40db-9c3b-b2e93520fc01	P14	normalidad	5	2025-12-23 16:00:19.380805-06
1050	56222357-bef0-40db-9c3b-b2e93520fc01	P14	gravedad	4	2025-12-23 16:00:19.380805-06
1051	56222357-bef0-40db-9c3b-b2e93520fc01	P15	frecuencia	4	2025-12-23 16:00:19.380805-06
1052	56222357-bef0-40db-9c3b-b2e93520fc01	P15	normalidad	4	2025-12-23 16:00:19.380805-06
1053	56222357-bef0-40db-9c3b-b2e93520fc01	P15	gravedad	5	2025-12-23 16:00:19.380805-06
1054	56222357-bef0-40db-9c3b-b2e93520fc01	P16	frecuencia	4	2025-12-23 16:00:19.380805-06
1055	56222357-bef0-40db-9c3b-b2e93520fc01	P16	normalidad	4	2025-12-23 16:00:19.380805-06
1056	56222357-bef0-40db-9c3b-b2e93520fc01	P16	gravedad	5	2025-12-23 16:00:19.380805-06
1057	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P1	frecuencia	4	2025-12-24 02:43:00.041086-06
1058	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P1	normalidad	3	2025-12-24 02:43:00.041086-06
1059	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P1	gravedad	4	2025-12-24 02:43:00.041086-06
1060	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P2	frecuencia	4	2025-12-24 02:43:00.041086-06
1061	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P2	normalidad	4	2025-12-24 02:43:00.041086-06
1062	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P2	gravedad	4	2025-12-24 02:43:00.041086-06
1063	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P3	frecuencia	4	2025-12-24 02:43:00.041086-06
1064	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P3	normalidad	4	2025-12-24 02:43:00.041086-06
1065	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P3	gravedad	3	2025-12-24 02:43:00.041086-06
1066	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P4	frecuencia	5	2025-12-24 02:43:00.041086-06
1067	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P4	normalidad	4	2025-12-24 02:43:00.041086-06
1068	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P4	gravedad	4	2025-12-24 02:43:00.041086-06
1069	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P5	frecuencia	5	2025-12-24 02:43:00.041086-06
1070	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P5	normalidad	4	2025-12-24 02:43:00.041086-06
1071	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P5	gravedad	4	2025-12-24 02:43:00.041086-06
1072	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P6	frecuencia	5	2025-12-24 02:43:00.041086-06
1073	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P6	normalidad	5	2025-12-24 02:43:00.041086-06
1074	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P6	gravedad	5	2025-12-24 02:43:00.041086-06
1075	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P7	frecuencia	4	2025-12-24 02:43:00.041086-06
1076	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P7	normalidad	4	2025-12-24 02:43:00.041086-06
1077	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P7	gravedad	4	2025-12-24 02:43:00.041086-06
1078	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P8	frecuencia	5	2025-12-24 02:43:00.041086-06
1079	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P8	normalidad	5	2025-12-24 02:43:00.041086-06
1080	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P8	gravedad	5	2025-12-24 02:43:00.041086-06
1081	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P9	frecuencia	4	2025-12-24 02:43:00.041086-06
1082	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P9	normalidad	4	2025-12-24 02:43:00.041086-06
1083	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P9	gravedad	5	2025-12-24 02:43:00.041086-06
1084	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P10	frecuencia	5	2025-12-24 02:43:00.041086-06
1085	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P10	normalidad	4	2025-12-24 02:43:00.041086-06
1086	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P10	gravedad	5	2025-12-24 02:43:00.041086-06
1087	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P11	frecuencia	5	2025-12-24 02:43:00.041086-06
1088	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P11	normalidad	4	2025-12-24 02:43:00.041086-06
1089	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P11	gravedad	5	2025-12-24 02:43:00.041086-06
1090	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P12	frecuencia	5	2025-12-24 02:43:00.041086-06
1091	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P12	normalidad	4	2025-12-24 02:43:00.041086-06
1092	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P12	gravedad	5	2025-12-24 02:43:00.041086-06
1093	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P13	frecuencia	5	2025-12-24 02:43:00.041086-06
1094	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P13	normalidad	4	2025-12-24 02:43:00.041086-06
1095	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P13	gravedad	5	2025-12-24 02:43:00.041086-06
1096	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P14	frecuencia	5	2025-12-24 02:43:00.041086-06
1097	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P14	normalidad	5	2025-12-24 02:43:00.041086-06
1098	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P14	gravedad	5	2025-12-24 02:43:00.041086-06
1099	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P15	frecuencia	4	2025-12-24 02:43:00.041086-06
1100	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P15	normalidad	4	2025-12-24 02:43:00.041086-06
1101	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P15	gravedad	5	2025-12-24 02:43:00.041086-06
1102	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P16	frecuencia	5	2025-12-24 02:43:00.041086-06
1103	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P16	normalidad	4	2025-12-24 02:43:00.041086-06
1104	34fa1f2e-ebfb-4f4e-9564-e17c5b227549	P16	gravedad	4	2025-12-24 02:43:00.041086-06
1105	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P1	frecuencia	1	2025-12-24 04:45:25.548792-06
1106	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P1	normalidad	2	2025-12-24 04:45:25.548792-06
1107	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P1	gravedad	3	2025-12-24 04:45:25.548792-06
1108	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P2	frecuencia	5	2025-12-24 04:45:25.548792-06
1109	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P2	normalidad	4	2025-12-24 04:45:25.548792-06
1110	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P2	gravedad	3	2025-12-24 04:45:25.548792-06
1111	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P3	frecuencia	1	2025-12-24 04:45:25.548792-06
1112	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P3	normalidad	2	2025-12-24 04:45:25.548792-06
1113	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P3	gravedad	3	2025-12-24 04:45:25.548792-06
1114	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P4	frecuencia	5	2025-12-24 04:45:25.548792-06
1115	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P4	normalidad	4	2025-12-24 04:45:25.548792-06
1116	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P4	gravedad	3	2025-12-24 04:45:25.548792-06
1117	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P5	frecuencia	1	2025-12-24 04:45:25.548792-06
1118	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P5	normalidad	2	2025-12-24 04:45:25.548792-06
1119	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P5	gravedad	3	2025-12-24 04:45:25.548792-06
1120	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P6	frecuencia	5	2025-12-24 04:45:25.548792-06
1121	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P6	normalidad	4	2025-12-24 04:45:25.548792-06
1122	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P6	gravedad	3	2025-12-24 04:45:25.548792-06
1123	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P7	frecuencia	1	2025-12-24 04:45:25.548792-06
1124	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P7	normalidad	2	2025-12-24 04:45:25.548792-06
1125	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P7	gravedad	3	2025-12-24 04:45:25.548792-06
1126	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P8	frecuencia	5	2025-12-24 04:45:25.548792-06
1127	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P8	normalidad	4	2025-12-24 04:45:25.548792-06
1128	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P8	gravedad	3	2025-12-24 04:45:25.548792-06
1129	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P9	frecuencia	1	2025-12-24 04:45:25.548792-06
1130	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P9	normalidad	2	2025-12-24 04:45:25.548792-06
1131	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P9	gravedad	3	2025-12-24 04:45:25.548792-06
1132	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P10	frecuencia	5	2025-12-24 04:45:25.548792-06
1133	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P10	normalidad	4	2025-12-24 04:45:25.548792-06
1134	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P10	gravedad	3	2025-12-24 04:45:25.548792-06
1135	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P11	frecuencia	1	2025-12-24 04:45:25.548792-06
1136	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P11	normalidad	2	2025-12-24 04:45:25.548792-06
1137	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P11	gravedad	3	2025-12-24 04:45:25.548792-06
1138	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P12	frecuencia	5	2025-12-24 04:45:25.548792-06
1139	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P12	normalidad	4	2025-12-24 04:45:25.548792-06
1140	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P12	gravedad	3	2025-12-24 04:45:25.548792-06
1141	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P13	frecuencia	1	2025-12-24 04:45:25.548792-06
1142	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P13	normalidad	2	2025-12-24 04:45:25.548792-06
1143	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P13	gravedad	3	2025-12-24 04:45:25.548792-06
1144	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P14	frecuencia	5	2025-12-24 04:45:25.548792-06
1145	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P14	normalidad	4	2025-12-24 04:45:25.548792-06
1146	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P14	gravedad	3	2025-12-24 04:45:25.548792-06
1147	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P15	frecuencia	1	2025-12-24 04:45:25.548792-06
1148	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P15	normalidad	2	2025-12-24 04:45:25.548792-06
1149	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P15	gravedad	3	2025-12-24 04:45:25.548792-06
1150	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P16	frecuencia	5	2025-12-24 04:45:25.548792-06
1151	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P16	normalidad	4	2025-12-24 04:45:25.548792-06
1152	7c1de0e7-9e9c-4899-bdcf-8db05948fc4f	P16	gravedad	3	2025-12-24 04:45:25.548792-06
1153	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P1	frecuencia	2	2025-12-25 12:41:34.201592-06
1154	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P1	normalidad	3	2025-12-25 12:41:34.201592-06
1155	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P1	gravedad	3	2025-12-25 12:41:34.201592-06
1156	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P2	frecuencia	4	2025-12-25 12:41:34.201592-06
1157	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P2	normalidad	4	2025-12-25 12:41:34.201592-06
1158	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P2	gravedad	3	2025-12-25 12:41:34.201592-06
1159	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P3	frecuencia	4	2025-12-25 12:41:34.201592-06
1160	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P3	normalidad	4	2025-12-25 12:41:34.201592-06
1161	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P3	gravedad	4	2025-12-25 12:41:34.201592-06
1162	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P4	frecuencia	3	2025-12-25 12:41:34.201592-06
1163	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P4	normalidad	4	2025-12-25 12:41:34.201592-06
1164	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P4	gravedad	3	2025-12-25 12:41:34.201592-06
1165	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P5	frecuencia	4	2025-12-25 12:41:34.201592-06
1166	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P5	normalidad	4	2025-12-25 12:41:34.201592-06
1167	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P5	gravedad	4	2025-12-25 12:41:34.201592-06
1168	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P6	frecuencia	3	2025-12-25 12:41:34.201592-06
1169	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P6	normalidad	4	2025-12-25 12:41:34.201592-06
1170	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P6	gravedad	3	2025-12-25 12:41:34.201592-06
1171	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P7	frecuencia	3	2025-12-25 12:41:34.201592-06
1172	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P7	normalidad	4	2025-12-25 12:41:34.201592-06
1173	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P7	gravedad	3	2025-12-25 12:41:34.201592-06
1174	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P8	frecuencia	4	2025-12-25 12:41:34.201592-06
1175	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P8	normalidad	4	2025-12-25 12:41:34.201592-06
1176	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P8	gravedad	3	2025-12-25 12:41:34.201592-06
1177	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P9	frecuencia	3	2025-12-25 12:41:34.201592-06
1178	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P9	normalidad	4	2025-12-25 12:41:34.201592-06
1179	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P9	gravedad	3	2025-12-25 12:41:34.201592-06
1180	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P10	frecuencia	3	2025-12-25 12:41:34.201592-06
1181	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P10	normalidad	4	2025-12-25 12:41:34.201592-06
1182	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P10	gravedad	3	2025-12-25 12:41:34.201592-06
1183	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P11	frecuencia	4	2025-12-25 12:41:34.201592-06
1184	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P11	normalidad	4	2025-12-25 12:41:34.201592-06
1185	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P11	gravedad	3	2025-12-25 12:41:34.201592-06
1186	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P12	frecuencia	4	2025-12-25 12:41:34.201592-06
1187	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P12	normalidad	4	2025-12-25 12:41:34.201592-06
1188	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P12	gravedad	3	2025-12-25 12:41:34.201592-06
1189	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P13	frecuencia	3	2025-12-25 12:41:34.201592-06
1190	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P13	normalidad	4	2025-12-25 12:41:34.201592-06
1191	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P13	gravedad	4	2025-12-25 12:41:34.201592-06
1192	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P14	frecuencia	3	2025-12-25 12:41:34.201592-06
1193	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P14	normalidad	4	2025-12-25 12:41:34.201592-06
1194	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P14	gravedad	4	2025-12-25 12:41:34.201592-06
1195	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P15	frecuencia	4	2025-12-25 12:41:34.201592-06
1196	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P15	normalidad	4	2025-12-25 12:41:34.201592-06
1197	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P15	gravedad	3	2025-12-25 12:41:34.201592-06
1198	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P16	frecuencia	4	2025-12-25 12:41:34.201592-06
1199	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P16	normalidad	4	2025-12-25 12:41:34.201592-06
1200	59822a5b-cb10-4645-b7a8-637dc9bb2fb8	P16	gravedad	4	2025-12-25 12:41:34.201592-06
1201	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P1	frecuencia	3	2025-12-25 12:45:28.233288-06
1202	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P1	normalidad	3	2025-12-25 12:45:28.233288-06
1203	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P1	gravedad	3	2025-12-25 12:45:28.233288-06
1204	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P2	frecuencia	4	2025-12-25 12:45:28.233288-06
1205	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P2	normalidad	3	2025-12-25 12:45:28.233288-06
1206	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P2	gravedad	4	2025-12-25 12:45:28.233288-06
1207	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P3	frecuencia	5	2025-12-25 12:45:28.233288-06
1208	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P3	normalidad	4	2025-12-25 12:45:28.233288-06
1209	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P3	gravedad	4	2025-12-25 12:45:28.233288-06
1210	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P4	frecuencia	5	2025-12-25 12:45:28.233288-06
1211	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P4	normalidad	4	2025-12-25 12:45:28.233288-06
1212	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P4	gravedad	5	2025-12-25 12:45:28.233288-06
1213	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P5	frecuencia	4	2025-12-25 12:45:28.233288-06
1214	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P5	normalidad	3	2025-12-25 12:45:28.233288-06
1215	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P5	gravedad	4	2025-12-25 12:45:28.233288-06
1216	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P6	frecuencia	4	2025-12-25 12:45:28.233288-06
1217	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P6	normalidad	5	2025-12-25 12:45:28.233288-06
1218	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P6	gravedad	5	2025-12-25 12:45:28.233288-06
1219	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P7	frecuencia	3	2025-12-25 12:45:28.233288-06
1220	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P7	normalidad	5	2025-12-25 12:45:28.233288-06
1221	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P7	gravedad	4	2025-12-25 12:45:28.233288-06
1222	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P8	frecuencia	4	2025-12-25 12:45:28.233288-06
1223	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P8	normalidad	5	2025-12-25 12:45:28.233288-06
1224	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P8	gravedad	4	2025-12-25 12:45:28.233288-06
1225	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P9	frecuencia	4	2025-12-25 12:45:28.233288-06
1226	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P9	normalidad	5	2025-12-25 12:45:28.233288-06
1227	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P9	gravedad	5	2025-12-25 12:45:28.233288-06
1228	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P10	frecuencia	4	2025-12-25 12:45:28.233288-06
1229	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P10	normalidad	5	2025-12-25 12:45:28.233288-06
1230	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P10	gravedad	5	2025-12-25 12:45:28.233288-06
1231	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P11	frecuencia	5	2025-12-25 12:45:28.233288-06
1232	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P11	normalidad	4	2025-12-25 12:45:28.233288-06
1233	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P11	gravedad	4	2025-12-25 12:45:28.233288-06
1234	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P12	frecuencia	4	2025-12-25 12:45:28.233288-06
1235	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P12	normalidad	5	2025-12-25 12:45:28.233288-06
1236	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P12	gravedad	5	2025-12-25 12:45:28.233288-06
1237	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P13	frecuencia	4	2025-12-25 12:45:28.233288-06
1238	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P13	normalidad	5	2025-12-25 12:45:28.233288-06
1239	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P13	gravedad	5	2025-12-25 12:45:28.233288-06
1240	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P14	frecuencia	4	2025-12-25 12:45:28.233288-06
1241	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P14	normalidad	5	2025-12-25 12:45:28.233288-06
1242	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P14	gravedad	5	2025-12-25 12:45:28.233288-06
1243	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P15	frecuencia	4	2025-12-25 12:45:28.233288-06
1244	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P15	normalidad	5	2025-12-25 12:45:28.233288-06
1245	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P15	gravedad	5	2025-12-25 12:45:28.233288-06
1246	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P16	frecuencia	4	2025-12-25 12:45:28.233288-06
1247	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P16	normalidad	5	2025-12-25 12:45:28.233288-06
1248	3eee1c58-385b-4a83-aaf6-2ddfeb4018c7	P16	gravedad	5	2025-12-25 12:45:28.233288-06
1249	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P1	frecuencia	3	2025-12-25 13:25:33.81964-06
1250	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P1	normalidad	3	2025-12-25 13:25:33.81964-06
1251	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P1	gravedad	2	2025-12-25 13:25:33.81964-06
1252	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P2	frecuencia	3	2025-12-25 13:25:33.81964-06
1253	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P2	normalidad	3	2025-12-25 13:25:33.81964-06
1254	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P2	gravedad	3	2025-12-25 13:25:33.81964-06
1255	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P3	frecuencia	3	2025-12-25 13:25:33.81964-06
1256	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P3	normalidad	3	2025-12-25 13:25:33.81964-06
1257	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P3	gravedad	4	2025-12-25 13:25:33.81964-06
1258	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P4	frecuencia	4	2025-12-25 13:25:33.81964-06
1259	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P4	normalidad	2	2025-12-25 13:25:33.81964-06
1260	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P4	gravedad	3	2025-12-25 13:25:33.81964-06
1261	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P5	frecuencia	5	2025-12-25 13:25:33.81964-06
1262	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P5	normalidad	5	2025-12-25 13:25:33.81964-06
1263	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P5	gravedad	5	2025-12-25 13:25:33.81964-06
1264	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P6	frecuencia	5	2025-12-25 13:25:33.81964-06
1265	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P6	normalidad	4	2025-12-25 13:25:33.81964-06
1266	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P6	gravedad	4	2025-12-25 13:25:33.81964-06
1267	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P7	frecuencia	4	2025-12-25 13:25:33.81964-06
1268	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P7	normalidad	5	2025-12-25 13:25:33.81964-06
1269	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P7	gravedad	4	2025-12-25 13:25:33.81964-06
1270	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P8	frecuencia	4	2025-12-25 13:25:33.81964-06
1271	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P8	normalidad	5	2025-12-25 13:25:33.81964-06
1272	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P8	gravedad	4	2025-12-25 13:25:33.81964-06
1273	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P9	frecuencia	4	2025-12-25 13:25:33.81964-06
1274	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P9	normalidad	5	2025-12-25 13:25:33.81964-06
1275	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P9	gravedad	4	2025-12-25 13:25:33.81964-06
1276	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P10	frecuencia	4	2025-12-25 13:25:33.81964-06
1277	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P10	normalidad	5	2025-12-25 13:25:33.81964-06
1278	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P10	gravedad	4	2025-12-25 13:25:33.81964-06
1279	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P11	frecuencia	4	2025-12-25 13:25:33.81964-06
1280	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P11	normalidad	5	2025-12-25 13:25:33.81964-06
1281	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P11	gravedad	5	2025-12-25 13:25:33.81964-06
1282	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P12	frecuencia	5	2025-12-25 13:25:33.81964-06
1283	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P12	normalidad	5	2025-12-25 13:25:33.81964-06
1284	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P12	gravedad	5	2025-12-25 13:25:33.81964-06
1285	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P13	frecuencia	4	2025-12-25 13:25:33.81964-06
1286	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P13	normalidad	5	2025-12-25 13:25:33.81964-06
1287	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P13	gravedad	4	2025-12-25 13:25:33.81964-06
1288	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P14	frecuencia	5	2025-12-25 13:25:33.81964-06
1289	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P14	normalidad	4	2025-12-25 13:25:33.81964-06
1290	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P14	gravedad	5	2025-12-25 13:25:33.81964-06
1291	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P15	frecuencia	4	2025-12-25 13:25:33.81964-06
1292	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P15	normalidad	5	2025-12-25 13:25:33.81964-06
1293	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P15	gravedad	4	2025-12-25 13:25:33.81964-06
1294	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P16	frecuencia	5	2025-12-25 13:25:33.81964-06
1295	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P16	normalidad	4	2025-12-25 13:25:33.81964-06
1296	6f4b29e2-1c0f-4a27-a958-50a691690ad0	P16	gravedad	4	2025-12-25 13:25:33.81964-06
1297	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P1	frecuencia	2	2025-12-25 18:38:11.9906-06
1298	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P1	normalidad	2	2025-12-25 18:38:11.9906-06
1299	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P1	gravedad	3	2025-12-25 18:38:11.9906-06
1300	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P2	frecuencia	4	2025-12-25 18:38:11.9906-06
1301	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P2	normalidad	3	2025-12-25 18:38:11.9906-06
1302	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P2	gravedad	3	2025-12-25 18:38:11.9906-06
1303	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P3	frecuencia	3	2025-12-25 18:38:11.9906-06
1304	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P3	normalidad	4	2025-12-25 18:38:11.9906-06
1305	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P3	gravedad	2	2025-12-25 18:38:11.9906-06
1306	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P4	frecuencia	4	2025-12-25 18:38:11.9906-06
1307	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P4	normalidad	3	2025-12-25 18:38:11.9906-06
1308	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P4	gravedad	4	2025-12-25 18:38:11.9906-06
1309	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P5	frecuencia	3	2025-12-25 18:38:11.9906-06
1310	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P5	normalidad	4	2025-12-25 18:38:11.9906-06
1311	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P5	gravedad	3	2025-12-25 18:38:11.9906-06
1312	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P6	frecuencia	3	2025-12-25 18:38:11.9906-06
1313	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P6	normalidad	3	2025-12-25 18:38:11.9906-06
1314	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P6	gravedad	4	2025-12-25 18:38:11.9906-06
1315	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P7	frecuencia	3	2025-12-25 18:38:11.9906-06
1316	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P7	normalidad	4	2025-12-25 18:38:11.9906-06
1317	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P7	gravedad	4	2025-12-25 18:38:11.9906-06
1318	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P8	frecuencia	3	2025-12-25 18:38:11.9906-06
1319	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P8	normalidad	4	2025-12-25 18:38:11.9906-06
1320	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P8	gravedad	3	2025-12-25 18:38:11.9906-06
1321	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P9	frecuencia	3	2025-12-25 18:38:11.9906-06
1322	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P9	normalidad	4	2025-12-25 18:38:11.9906-06
1323	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P9	gravedad	3	2025-12-25 18:38:11.9906-06
1324	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P10	frecuencia	4	2025-12-25 18:38:11.9906-06
1325	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P10	normalidad	3	2025-12-25 18:38:11.9906-06
1326	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P10	gravedad	4	2025-12-25 18:38:11.9906-06
1327	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P11	frecuencia	3	2025-12-25 18:38:11.9906-06
1328	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P11	normalidad	5	2025-12-25 18:38:11.9906-06
1329	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P11	gravedad	4	2025-12-25 18:38:11.9906-06
1330	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P12	frecuencia	3	2025-12-25 18:38:11.9906-06
1331	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P12	normalidad	5	2025-12-25 18:38:11.9906-06
1332	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P12	gravedad	4	2025-12-25 18:38:11.9906-06
1333	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P13	frecuencia	4	2025-12-25 18:38:11.9906-06
1334	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P13	normalidad	4	2025-12-25 18:38:11.9906-06
1335	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P13	gravedad	4	2025-12-25 18:38:11.9906-06
1336	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P14	frecuencia	5	2025-12-25 18:38:11.9906-06
1337	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P14	normalidad	5	2025-12-25 18:38:11.9906-06
1338	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P14	gravedad	3	2025-12-25 18:38:11.9906-06
1339	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P15	frecuencia	3	2025-12-25 18:38:11.9906-06
1340	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P15	normalidad	4	2025-12-25 18:38:11.9906-06
1341	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P15	gravedad	4	2025-12-25 18:38:11.9906-06
1342	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P16	frecuencia	4	2025-12-25 18:38:11.9906-06
1343	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P16	normalidad	4	2025-12-25 18:38:11.9906-06
1344	0bc88783-9ae9-4f7d-b061-ccce7302f24f	P16	gravedad	4	2025-12-25 18:38:11.9906-06
1345	99abf3d3-f393-425d-8f38-7e35ac490475	P1	frecuencia	2	2025-12-25 18:41:26.103079-06
1346	99abf3d3-f393-425d-8f38-7e35ac490475	P1	normalidad	2	2025-12-25 18:41:26.103079-06
1347	99abf3d3-f393-425d-8f38-7e35ac490475	P1	gravedad	3	2025-12-25 18:41:26.103079-06
1348	99abf3d3-f393-425d-8f38-7e35ac490475	P2	frecuencia	2	2025-12-25 18:41:26.103079-06
1349	99abf3d3-f393-425d-8f38-7e35ac490475	P2	normalidad	2	2025-12-25 18:41:26.103079-06
1350	99abf3d3-f393-425d-8f38-7e35ac490475	P2	gravedad	2	2025-12-25 18:41:26.103079-06
1351	99abf3d3-f393-425d-8f38-7e35ac490475	P3	frecuencia	3	2025-12-25 18:41:26.103079-06
1352	99abf3d3-f393-425d-8f38-7e35ac490475	P3	normalidad	2	2025-12-25 18:41:26.103079-06
1353	99abf3d3-f393-425d-8f38-7e35ac490475	P3	gravedad	3	2025-12-25 18:41:26.103079-06
1354	99abf3d3-f393-425d-8f38-7e35ac490475	P4	frecuencia	2	2025-12-25 18:41:26.103079-06
1355	99abf3d3-f393-425d-8f38-7e35ac490475	P4	normalidad	3	2025-12-25 18:41:26.103079-06
1356	99abf3d3-f393-425d-8f38-7e35ac490475	P4	gravedad	3	2025-12-25 18:41:26.103079-06
1357	99abf3d3-f393-425d-8f38-7e35ac490475	P5	frecuencia	2	2025-12-25 18:41:26.103079-06
1358	99abf3d3-f393-425d-8f38-7e35ac490475	P5	normalidad	3	2025-12-25 18:41:26.103079-06
1359	99abf3d3-f393-425d-8f38-7e35ac490475	P5	gravedad	4	2025-12-25 18:41:26.103079-06
1360	99abf3d3-f393-425d-8f38-7e35ac490475	P6	frecuencia	2	2025-12-25 18:41:26.103079-06
1361	99abf3d3-f393-425d-8f38-7e35ac490475	P6	normalidad	4	2025-12-25 18:41:26.103079-06
1362	99abf3d3-f393-425d-8f38-7e35ac490475	P6	gravedad	4	2025-12-25 18:41:26.103079-06
1363	99abf3d3-f393-425d-8f38-7e35ac490475	P7	frecuencia	3	2025-12-25 18:41:26.103079-06
1364	99abf3d3-f393-425d-8f38-7e35ac490475	P7	normalidad	2	2025-12-25 18:41:26.103079-06
1365	99abf3d3-f393-425d-8f38-7e35ac490475	P7	gravedad	3	2025-12-25 18:41:26.103079-06
1366	99abf3d3-f393-425d-8f38-7e35ac490475	P8	frecuencia	2	2025-12-25 18:41:26.103079-06
1367	99abf3d3-f393-425d-8f38-7e35ac490475	P8	normalidad	3	2025-12-25 18:41:26.103079-06
1368	99abf3d3-f393-425d-8f38-7e35ac490475	P8	gravedad	3	2025-12-25 18:41:26.103079-06
1369	99abf3d3-f393-425d-8f38-7e35ac490475	P9	frecuencia	3	2025-12-25 18:41:26.103079-06
1370	99abf3d3-f393-425d-8f38-7e35ac490475	P9	normalidad	3	2025-12-25 18:41:26.103079-06
1371	99abf3d3-f393-425d-8f38-7e35ac490475	P9	gravedad	2	2025-12-25 18:41:26.103079-06
1372	99abf3d3-f393-425d-8f38-7e35ac490475	P10	frecuencia	3	2025-12-25 18:41:26.103079-06
1373	99abf3d3-f393-425d-8f38-7e35ac490475	P10	normalidad	4	2025-12-25 18:41:26.103079-06
1374	99abf3d3-f393-425d-8f38-7e35ac490475	P10	gravedad	4	2025-12-25 18:41:26.103079-06
1375	99abf3d3-f393-425d-8f38-7e35ac490475	P11	frecuencia	3	2025-12-25 18:41:26.103079-06
1376	99abf3d3-f393-425d-8f38-7e35ac490475	P11	normalidad	4	2025-12-25 18:41:26.103079-06
1377	99abf3d3-f393-425d-8f38-7e35ac490475	P11	gravedad	3	2025-12-25 18:41:26.103079-06
1378	99abf3d3-f393-425d-8f38-7e35ac490475	P12	frecuencia	4	2025-12-25 18:41:26.103079-06
1379	99abf3d3-f393-425d-8f38-7e35ac490475	P12	normalidad	3	2025-12-25 18:41:26.103079-06
1380	99abf3d3-f393-425d-8f38-7e35ac490475	P12	gravedad	4	2025-12-25 18:41:26.103079-06
1381	99abf3d3-f393-425d-8f38-7e35ac490475	P13	frecuencia	4	2025-12-25 18:41:26.103079-06
1382	99abf3d3-f393-425d-8f38-7e35ac490475	P13	normalidad	4	2025-12-25 18:41:26.103079-06
1383	99abf3d3-f393-425d-8f38-7e35ac490475	P13	gravedad	4	2025-12-25 18:41:26.103079-06
1384	99abf3d3-f393-425d-8f38-7e35ac490475	P14	frecuencia	4	2025-12-25 18:41:26.103079-06
1385	99abf3d3-f393-425d-8f38-7e35ac490475	P14	normalidad	4	2025-12-25 18:41:26.103079-06
1386	99abf3d3-f393-425d-8f38-7e35ac490475	P14	gravedad	4	2025-12-25 18:41:26.103079-06
1387	99abf3d3-f393-425d-8f38-7e35ac490475	P15	frecuencia	2	2025-12-25 18:41:26.103079-06
1388	99abf3d3-f393-425d-8f38-7e35ac490475	P15	normalidad	3	2025-12-25 18:41:26.103079-06
1389	99abf3d3-f393-425d-8f38-7e35ac490475	P15	gravedad	4	2025-12-25 18:41:26.103079-06
1390	99abf3d3-f393-425d-8f38-7e35ac490475	P16	frecuencia	4	2025-12-25 18:41:26.103079-06
1391	99abf3d3-f393-425d-8f38-7e35ac490475	P16	normalidad	2	2025-12-25 18:41:26.103079-06
1392	99abf3d3-f393-425d-8f38-7e35ac490475	P16	gravedad	5	2025-12-25 18:41:26.103079-06
1393	20acd552-a741-4c31-be87-f9a4949797dd	P1	frecuencia	2	2025-12-25 18:50:21.189714-06
1394	20acd552-a741-4c31-be87-f9a4949797dd	P1	normalidad	2	2025-12-25 18:50:21.189714-06
1395	20acd552-a741-4c31-be87-f9a4949797dd	P1	gravedad	3	2025-12-25 18:50:21.189714-06
1396	20acd552-a741-4c31-be87-f9a4949797dd	P2	frecuencia	2	2025-12-25 18:50:21.189714-06
1397	20acd552-a741-4c31-be87-f9a4949797dd	P2	normalidad	4	2025-12-25 18:50:21.189714-06
1398	20acd552-a741-4c31-be87-f9a4949797dd	P2	gravedad	3	2025-12-25 18:50:21.189714-06
1399	20acd552-a741-4c31-be87-f9a4949797dd	P3	frecuencia	2	2025-12-25 18:50:21.189714-06
1400	20acd552-a741-4c31-be87-f9a4949797dd	P3	normalidad	4	2025-12-25 18:50:21.189714-06
1401	20acd552-a741-4c31-be87-f9a4949797dd	P3	gravedad	3	2025-12-25 18:50:21.189714-06
1402	20acd552-a741-4c31-be87-f9a4949797dd	P4	frecuencia	3	2025-12-25 18:50:21.189714-06
1403	20acd552-a741-4c31-be87-f9a4949797dd	P4	normalidad	4	2025-12-25 18:50:21.189714-06
1404	20acd552-a741-4c31-be87-f9a4949797dd	P4	gravedad	3	2025-12-25 18:50:21.189714-06
1405	20acd552-a741-4c31-be87-f9a4949797dd	P5	frecuencia	3	2025-12-25 18:50:21.189714-06
1406	20acd552-a741-4c31-be87-f9a4949797dd	P5	normalidad	3	2025-12-25 18:50:21.189714-06
1407	20acd552-a741-4c31-be87-f9a4949797dd	P5	gravedad	4	2025-12-25 18:50:21.189714-06
1408	20acd552-a741-4c31-be87-f9a4949797dd	P6	frecuencia	4	2025-12-25 18:50:21.189714-06
1409	20acd552-a741-4c31-be87-f9a4949797dd	P6	normalidad	3	2025-12-25 18:50:21.189714-06
1410	20acd552-a741-4c31-be87-f9a4949797dd	P6	gravedad	4	2025-12-25 18:50:21.189714-06
1411	20acd552-a741-4c31-be87-f9a4949797dd	P7	frecuencia	2	2025-12-25 18:50:21.189714-06
1412	20acd552-a741-4c31-be87-f9a4949797dd	P7	normalidad	4	2025-12-25 18:50:21.189714-06
1413	20acd552-a741-4c31-be87-f9a4949797dd	P7	gravedad	3	2025-12-25 18:50:21.189714-06
1414	20acd552-a741-4c31-be87-f9a4949797dd	P8	frecuencia	3	2025-12-25 18:50:21.189714-06
1415	20acd552-a741-4c31-be87-f9a4949797dd	P8	normalidad	4	2025-12-25 18:50:21.189714-06
1416	20acd552-a741-4c31-be87-f9a4949797dd	P8	gravedad	3	2025-12-25 18:50:21.189714-06
1417	20acd552-a741-4c31-be87-f9a4949797dd	P9	frecuencia	3	2025-12-25 18:50:21.189714-06
1418	20acd552-a741-4c31-be87-f9a4949797dd	P9	normalidad	4	2025-12-25 18:50:21.189714-06
1419	20acd552-a741-4c31-be87-f9a4949797dd	P9	gravedad	4	2025-12-25 18:50:21.189714-06
1420	20acd552-a741-4c31-be87-f9a4949797dd	P10	frecuencia	4	2025-12-25 18:50:21.189714-06
1421	20acd552-a741-4c31-be87-f9a4949797dd	P10	normalidad	4	2025-12-25 18:50:21.189714-06
1422	20acd552-a741-4c31-be87-f9a4949797dd	P10	gravedad	4	2025-12-25 18:50:21.189714-06
1423	20acd552-a741-4c31-be87-f9a4949797dd	P11	frecuencia	3	2025-12-25 18:50:21.189714-06
1424	20acd552-a741-4c31-be87-f9a4949797dd	P11	normalidad	4	2025-12-25 18:50:21.189714-06
1425	20acd552-a741-4c31-be87-f9a4949797dd	P11	gravedad	4	2025-12-25 18:50:21.189714-06
1426	20acd552-a741-4c31-be87-f9a4949797dd	P12	frecuencia	2	2025-12-25 18:50:21.189714-06
1427	20acd552-a741-4c31-be87-f9a4949797dd	P12	normalidad	4	2025-12-25 18:50:21.189714-06
1428	20acd552-a741-4c31-be87-f9a4949797dd	P12	gravedad	4	2025-12-25 18:50:21.189714-06
1429	20acd552-a741-4c31-be87-f9a4949797dd	P13	frecuencia	2	2025-12-25 18:50:21.189714-06
1430	20acd552-a741-4c31-be87-f9a4949797dd	P13	normalidad	4	2025-12-25 18:50:21.189714-06
1431	20acd552-a741-4c31-be87-f9a4949797dd	P13	gravedad	3	2025-12-25 18:50:21.189714-06
1432	20acd552-a741-4c31-be87-f9a4949797dd	P14	frecuencia	3	2025-12-25 18:50:21.189714-06
1433	20acd552-a741-4c31-be87-f9a4949797dd	P14	normalidad	4	2025-12-25 18:50:21.189714-06
1434	20acd552-a741-4c31-be87-f9a4949797dd	P14	gravedad	3	2025-12-25 18:50:21.189714-06
1435	20acd552-a741-4c31-be87-f9a4949797dd	P15	frecuencia	4	2025-12-25 18:50:21.189714-06
1436	20acd552-a741-4c31-be87-f9a4949797dd	P15	normalidad	3	2025-12-25 18:50:21.189714-06
1437	20acd552-a741-4c31-be87-f9a4949797dd	P15	gravedad	5	2025-12-25 18:50:21.189714-06
1438	20acd552-a741-4c31-be87-f9a4949797dd	P16	frecuencia	3	2025-12-25 18:50:21.189714-06
1439	20acd552-a741-4c31-be87-f9a4949797dd	P16	normalidad	4	2025-12-25 18:50:21.189714-06
1440	20acd552-a741-4c31-be87-f9a4949797dd	P16	gravedad	5	2025-12-25 18:50:21.189714-06
1441	e2986526-d3ac-4115-a46d-489687e4a5b6	P1	frecuencia	3	2025-12-25 18:52:14.512869-06
1442	e2986526-d3ac-4115-a46d-489687e4a5b6	P1	normalidad	4	2025-12-25 18:52:14.512869-06
1443	e2986526-d3ac-4115-a46d-489687e4a5b6	P1	gravedad	3	2025-12-25 18:52:14.512869-06
1444	e2986526-d3ac-4115-a46d-489687e4a5b6	P2	frecuencia	4	2025-12-25 18:52:14.512869-06
1445	e2986526-d3ac-4115-a46d-489687e4a5b6	P2	normalidad	4	2025-12-25 18:52:14.512869-06
1446	e2986526-d3ac-4115-a46d-489687e4a5b6	P2	gravedad	5	2025-12-25 18:52:14.512869-06
1447	e2986526-d3ac-4115-a46d-489687e4a5b6	P3	frecuencia	4	2025-12-25 18:52:14.512869-06
1448	e2986526-d3ac-4115-a46d-489687e4a5b6	P3	normalidad	4	2025-12-25 18:52:14.512869-06
1449	e2986526-d3ac-4115-a46d-489687e4a5b6	P3	gravedad	5	2025-12-25 18:52:14.512869-06
1450	e2986526-d3ac-4115-a46d-489687e4a5b6	P4	frecuencia	4	2025-12-25 18:52:14.512869-06
1451	e2986526-d3ac-4115-a46d-489687e4a5b6	P4	normalidad	3	2025-12-25 18:52:14.512869-06
1452	e2986526-d3ac-4115-a46d-489687e4a5b6	P4	gravedad	5	2025-12-25 18:52:14.512869-06
1453	e2986526-d3ac-4115-a46d-489687e4a5b6	P5	frecuencia	3	2025-12-25 18:52:14.512869-06
1454	e2986526-d3ac-4115-a46d-489687e4a5b6	P5	normalidad	4	2025-12-25 18:52:14.512869-06
1455	e2986526-d3ac-4115-a46d-489687e4a5b6	P5	gravedad	5	2025-12-25 18:52:14.512869-06
1456	e2986526-d3ac-4115-a46d-489687e4a5b6	P6	frecuencia	4	2025-12-25 18:52:14.512869-06
1457	e2986526-d3ac-4115-a46d-489687e4a5b6	P6	normalidad	5	2025-12-25 18:52:14.512869-06
1458	e2986526-d3ac-4115-a46d-489687e4a5b6	P6	gravedad	5	2025-12-25 18:52:14.512869-06
1459	e2986526-d3ac-4115-a46d-489687e4a5b6	P7	frecuencia	4	2025-12-25 18:52:14.512869-06
1460	e2986526-d3ac-4115-a46d-489687e4a5b6	P7	normalidad	5	2025-12-25 18:52:14.512869-06
1461	e2986526-d3ac-4115-a46d-489687e4a5b6	P7	gravedad	5	2025-12-25 18:52:14.512869-06
1462	e2986526-d3ac-4115-a46d-489687e4a5b6	P8	frecuencia	4	2025-12-25 18:52:14.512869-06
1463	e2986526-d3ac-4115-a46d-489687e4a5b6	P8	normalidad	5	2025-12-25 18:52:14.512869-06
1464	e2986526-d3ac-4115-a46d-489687e4a5b6	P8	gravedad	3	2025-12-25 18:52:14.512869-06
1465	e2986526-d3ac-4115-a46d-489687e4a5b6	P9	frecuencia	2	2025-12-25 18:52:14.512869-06
1466	e2986526-d3ac-4115-a46d-489687e4a5b6	P9	normalidad	4	2025-12-25 18:52:14.512869-06
1467	e2986526-d3ac-4115-a46d-489687e4a5b6	P9	gravedad	2	2025-12-25 18:52:14.512869-06
1468	e2986526-d3ac-4115-a46d-489687e4a5b6	P10	frecuencia	1	2025-12-25 18:52:14.512869-06
1469	e2986526-d3ac-4115-a46d-489687e4a5b6	P10	normalidad	2	2025-12-25 18:52:14.512869-06
1470	e2986526-d3ac-4115-a46d-489687e4a5b6	P10	gravedad	5	2025-12-25 18:52:14.512869-06
1471	e2986526-d3ac-4115-a46d-489687e4a5b6	P11	frecuencia	3	2025-12-25 18:52:14.512869-06
1472	e2986526-d3ac-4115-a46d-489687e4a5b6	P11	normalidad	4	2025-12-25 18:52:14.512869-06
1473	e2986526-d3ac-4115-a46d-489687e4a5b6	P11	gravedad	3	2025-12-25 18:52:14.512869-06
1474	e2986526-d3ac-4115-a46d-489687e4a5b6	P12	frecuencia	5	2025-12-25 18:52:14.512869-06
1475	e2986526-d3ac-4115-a46d-489687e4a5b6	P12	normalidad	3	2025-12-25 18:52:14.512869-06
1476	e2986526-d3ac-4115-a46d-489687e4a5b6	P12	gravedad	5	2025-12-25 18:52:14.512869-06
1477	e2986526-d3ac-4115-a46d-489687e4a5b6	P13	frecuencia	4	2025-12-25 18:52:14.512869-06
1478	e2986526-d3ac-4115-a46d-489687e4a5b6	P13	normalidad	5	2025-12-25 18:52:14.512869-06
1479	e2986526-d3ac-4115-a46d-489687e4a5b6	P13	gravedad	4	2025-12-25 18:52:14.512869-06
1480	e2986526-d3ac-4115-a46d-489687e4a5b6	P14	frecuencia	5	2025-12-25 18:52:14.512869-06
1481	e2986526-d3ac-4115-a46d-489687e4a5b6	P14	normalidad	5	2025-12-25 18:52:14.512869-06
1482	e2986526-d3ac-4115-a46d-489687e4a5b6	P14	gravedad	4	2025-12-25 18:52:14.512869-06
1483	e2986526-d3ac-4115-a46d-489687e4a5b6	P15	frecuencia	5	2025-12-25 18:52:14.512869-06
1484	e2986526-d3ac-4115-a46d-489687e4a5b6	P15	normalidad	4	2025-12-25 18:52:14.512869-06
1485	e2986526-d3ac-4115-a46d-489687e4a5b6	P15	gravedad	4	2025-12-25 18:52:14.512869-06
1486	e2986526-d3ac-4115-a46d-489687e4a5b6	P16	frecuencia	5	2025-12-25 18:52:14.512869-06
1487	e2986526-d3ac-4115-a46d-489687e4a5b6	P16	normalidad	4	2025-12-25 18:52:14.512869-06
1488	e2986526-d3ac-4115-a46d-489687e4a5b6	P16	gravedad	4	2025-12-25 18:52:14.512869-06
1489	20902056-ec59-48a5-8167-6c5410281f07	P1	frecuencia	3	2025-12-25 19:34:00.068155-06
1490	20902056-ec59-48a5-8167-6c5410281f07	P1	normalidad	3	2025-12-25 19:34:00.068155-06
1491	20902056-ec59-48a5-8167-6c5410281f07	P1	gravedad	2	2025-12-25 19:34:00.068155-06
1492	20902056-ec59-48a5-8167-6c5410281f07	P2	frecuencia	2	2025-12-25 19:34:00.068155-06
1493	20902056-ec59-48a5-8167-6c5410281f07	P2	normalidad	2	2025-12-25 19:34:00.068155-06
1494	20902056-ec59-48a5-8167-6c5410281f07	P2	gravedad	2	2025-12-25 19:34:00.068155-06
1495	20902056-ec59-48a5-8167-6c5410281f07	P3	frecuencia	2	2025-12-25 19:34:00.068155-06
1496	20902056-ec59-48a5-8167-6c5410281f07	P3	normalidad	2	2025-12-25 19:34:00.068155-06
1497	20902056-ec59-48a5-8167-6c5410281f07	P3	gravedad	3	2025-12-25 19:34:00.068155-06
1498	20902056-ec59-48a5-8167-6c5410281f07	P4	frecuencia	2	2025-12-25 19:34:00.068155-06
1499	20902056-ec59-48a5-8167-6c5410281f07	P4	normalidad	2	2025-12-25 19:34:00.068155-06
1500	20902056-ec59-48a5-8167-6c5410281f07	P4	gravedad	3	2025-12-25 19:34:00.068155-06
1501	20902056-ec59-48a5-8167-6c5410281f07	P5	frecuencia	2	2025-12-25 19:34:00.068155-06
1502	20902056-ec59-48a5-8167-6c5410281f07	P5	normalidad	3	2025-12-25 19:34:00.068155-06
1503	20902056-ec59-48a5-8167-6c5410281f07	P5	gravedad	3	2025-12-25 19:34:00.068155-06
1504	20902056-ec59-48a5-8167-6c5410281f07	P6	frecuencia	3	2025-12-25 19:34:00.068155-06
1505	20902056-ec59-48a5-8167-6c5410281f07	P6	normalidad	3	2025-12-25 19:34:00.068155-06
1506	20902056-ec59-48a5-8167-6c5410281f07	P6	gravedad	2	2025-12-25 19:34:00.068155-06
1507	20902056-ec59-48a5-8167-6c5410281f07	P7	frecuencia	3	2025-12-25 19:34:00.068155-06
1508	20902056-ec59-48a5-8167-6c5410281f07	P7	normalidad	3	2025-12-25 19:34:00.068155-06
1509	20902056-ec59-48a5-8167-6c5410281f07	P7	gravedad	2	2025-12-25 19:34:00.068155-06
1510	20902056-ec59-48a5-8167-6c5410281f07	P8	frecuencia	3	2025-12-25 19:34:00.068155-06
1511	20902056-ec59-48a5-8167-6c5410281f07	P8	normalidad	3	2025-12-25 19:34:00.068155-06
1512	20902056-ec59-48a5-8167-6c5410281f07	P8	gravedad	3	2025-12-25 19:34:00.068155-06
1513	20902056-ec59-48a5-8167-6c5410281f07	P9	frecuencia	2	2025-12-25 19:34:00.068155-06
1514	20902056-ec59-48a5-8167-6c5410281f07	P9	normalidad	4	2025-12-25 19:34:00.068155-06
1515	20902056-ec59-48a5-8167-6c5410281f07	P9	gravedad	3	2025-12-25 19:34:00.068155-06
1516	20902056-ec59-48a5-8167-6c5410281f07	P10	frecuencia	3	2025-12-25 19:34:00.068155-06
1517	20902056-ec59-48a5-8167-6c5410281f07	P10	normalidad	4	2025-12-25 19:34:00.068155-06
1518	20902056-ec59-48a5-8167-6c5410281f07	P10	gravedad	4	2025-12-25 19:34:00.068155-06
1519	20902056-ec59-48a5-8167-6c5410281f07	P11	frecuencia	3	2025-12-25 19:34:00.068155-06
1520	20902056-ec59-48a5-8167-6c5410281f07	P11	normalidad	4	2025-12-25 19:34:00.068155-06
1521	20902056-ec59-48a5-8167-6c5410281f07	P11	gravedad	4	2025-12-25 19:34:00.068155-06
1522	20902056-ec59-48a5-8167-6c5410281f07	P12	frecuencia	2	2025-12-25 19:34:00.068155-06
1523	20902056-ec59-48a5-8167-6c5410281f07	P12	normalidad	4	2025-12-25 19:34:00.068155-06
1524	20902056-ec59-48a5-8167-6c5410281f07	P12	gravedad	4	2025-12-25 19:34:00.068155-06
1525	20902056-ec59-48a5-8167-6c5410281f07	P13	frecuencia	2	2025-12-25 19:34:00.068155-06
1526	20902056-ec59-48a5-8167-6c5410281f07	P13	normalidad	4	2025-12-25 19:34:00.068155-06
1527	20902056-ec59-48a5-8167-6c5410281f07	P13	gravedad	3	2025-12-25 19:34:00.068155-06
1528	20902056-ec59-48a5-8167-6c5410281f07	P14	frecuencia	3	2025-12-25 19:34:00.068155-06
1529	20902056-ec59-48a5-8167-6c5410281f07	P14	normalidad	4	2025-12-25 19:34:00.068155-06
1530	20902056-ec59-48a5-8167-6c5410281f07	P14	gravedad	4	2025-12-25 19:34:00.068155-06
1531	20902056-ec59-48a5-8167-6c5410281f07	P15	frecuencia	4	2025-12-25 19:34:00.068155-06
1532	20902056-ec59-48a5-8167-6c5410281f07	P15	normalidad	3	2025-12-25 19:34:00.068155-06
1533	20902056-ec59-48a5-8167-6c5410281f07	P15	gravedad	5	2025-12-25 19:34:00.068155-06
1534	20902056-ec59-48a5-8167-6c5410281f07	P16	frecuencia	5	2025-12-25 19:34:00.068155-06
1535	20902056-ec59-48a5-8167-6c5410281f07	P16	normalidad	4	2025-12-25 19:34:00.068155-06
1536	20902056-ec59-48a5-8167-6c5410281f07	P16	gravedad	4	2025-12-25 19:34:00.068155-06
1537	95c01992-ff5c-4e98-8901-f90d2d9825c0	P1	frecuencia	3	2025-12-26 20:24:06.237453-06
1538	95c01992-ff5c-4e98-8901-f90d2d9825c0	P1	normalidad	2	2025-12-26 20:24:06.237453-06
1539	95c01992-ff5c-4e98-8901-f90d2d9825c0	P1	gravedad	4	2025-12-26 20:24:06.237453-06
1540	95c01992-ff5c-4e98-8901-f90d2d9825c0	P2	frecuencia	3	2025-12-26 20:24:06.237453-06
1541	95c01992-ff5c-4e98-8901-f90d2d9825c0	P2	normalidad	4	2025-12-26 20:24:06.237453-06
1542	95c01992-ff5c-4e98-8901-f90d2d9825c0	P2	gravedad	3	2025-12-26 20:24:06.237453-06
1543	95c01992-ff5c-4e98-8901-f90d2d9825c0	P3	frecuencia	4	2025-12-26 20:24:06.237453-06
1544	95c01992-ff5c-4e98-8901-f90d2d9825c0	P3	normalidad	1	2025-12-26 20:24:06.237453-06
1545	95c01992-ff5c-4e98-8901-f90d2d9825c0	P3	gravedad	5	2025-12-26 20:24:06.237453-06
1546	95c01992-ff5c-4e98-8901-f90d2d9825c0	P4	frecuencia	4	2025-12-26 20:24:06.237453-06
1547	95c01992-ff5c-4e98-8901-f90d2d9825c0	P4	normalidad	3	2025-12-26 20:24:06.237453-06
1548	95c01992-ff5c-4e98-8901-f90d2d9825c0	P4	gravedad	3	2025-12-26 20:24:06.237453-06
1549	95c01992-ff5c-4e98-8901-f90d2d9825c0	P5	frecuencia	2	2025-12-26 20:24:06.237453-06
1550	95c01992-ff5c-4e98-8901-f90d2d9825c0	P5	normalidad	4	2025-12-26 20:24:06.237453-06
1551	95c01992-ff5c-4e98-8901-f90d2d9825c0	P5	gravedad	5	2025-12-26 20:24:06.237453-06
1552	95c01992-ff5c-4e98-8901-f90d2d9825c0	P6	frecuencia	4	2025-12-26 20:24:06.237453-06
1553	95c01992-ff5c-4e98-8901-f90d2d9825c0	P6	normalidad	4	2025-12-26 20:24:06.237453-06
1554	95c01992-ff5c-4e98-8901-f90d2d9825c0	P6	gravedad	5	2025-12-26 20:24:06.237453-06
1555	95c01992-ff5c-4e98-8901-f90d2d9825c0	P7	frecuencia	3	2025-12-26 20:24:06.237453-06
1556	95c01992-ff5c-4e98-8901-f90d2d9825c0	P7	normalidad	4	2025-12-26 20:24:06.237453-06
1557	95c01992-ff5c-4e98-8901-f90d2d9825c0	P7	gravedad	5	2025-12-26 20:24:06.237453-06
1558	95c01992-ff5c-4e98-8901-f90d2d9825c0	P8	frecuencia	4	2025-12-26 20:24:06.237453-06
1559	95c01992-ff5c-4e98-8901-f90d2d9825c0	P8	normalidad	5	2025-12-26 20:24:06.237453-06
1560	95c01992-ff5c-4e98-8901-f90d2d9825c0	P8	gravedad	5	2025-12-26 20:24:06.237453-06
1561	95c01992-ff5c-4e98-8901-f90d2d9825c0	P9	frecuencia	3	2025-12-26 20:24:06.237453-06
1562	95c01992-ff5c-4e98-8901-f90d2d9825c0	P9	normalidad	4	2025-12-26 20:24:06.237453-06
1563	95c01992-ff5c-4e98-8901-f90d2d9825c0	P9	gravedad	4	2025-12-26 20:24:06.237453-06
1564	95c01992-ff5c-4e98-8901-f90d2d9825c0	P10	frecuencia	4	2025-12-26 20:24:06.237453-06
1565	95c01992-ff5c-4e98-8901-f90d2d9825c0	P10	normalidad	4	2025-12-26 20:24:06.237453-06
1566	95c01992-ff5c-4e98-8901-f90d2d9825c0	P10	gravedad	4	2025-12-26 20:24:06.237453-06
1567	95c01992-ff5c-4e98-8901-f90d2d9825c0	P11	frecuencia	4	2025-12-26 20:24:06.237453-06
1568	95c01992-ff5c-4e98-8901-f90d2d9825c0	P11	normalidad	5	2025-12-26 20:24:06.237453-06
1569	95c01992-ff5c-4e98-8901-f90d2d9825c0	P11	gravedad	4	2025-12-26 20:24:06.237453-06
1570	95c01992-ff5c-4e98-8901-f90d2d9825c0	P12	frecuencia	5	2025-12-26 20:24:06.237453-06
1571	95c01992-ff5c-4e98-8901-f90d2d9825c0	P12	normalidad	5	2025-12-26 20:24:06.237453-06
1572	95c01992-ff5c-4e98-8901-f90d2d9825c0	P12	gravedad	4	2025-12-26 20:24:06.237453-06
1573	95c01992-ff5c-4e98-8901-f90d2d9825c0	P13	frecuencia	2	2025-12-26 20:24:06.237453-06
1574	95c01992-ff5c-4e98-8901-f90d2d9825c0	P13	normalidad	3	2025-12-26 20:24:06.237453-06
1575	95c01992-ff5c-4e98-8901-f90d2d9825c0	P13	gravedad	3	2025-12-26 20:24:06.237453-06
1576	95c01992-ff5c-4e98-8901-f90d2d9825c0	P14	frecuencia	2	2025-12-26 20:24:06.237453-06
1577	95c01992-ff5c-4e98-8901-f90d2d9825c0	P14	normalidad	3	2025-12-26 20:24:06.237453-06
1578	95c01992-ff5c-4e98-8901-f90d2d9825c0	P14	gravedad	2	2025-12-26 20:24:06.237453-06
1579	95c01992-ff5c-4e98-8901-f90d2d9825c0	P15	frecuencia	2	2025-12-26 20:24:06.237453-06
1580	95c01992-ff5c-4e98-8901-f90d2d9825c0	P15	normalidad	2	2025-12-26 20:24:06.237453-06
1581	95c01992-ff5c-4e98-8901-f90d2d9825c0	P15	gravedad	3	2025-12-26 20:24:06.237453-06
1582	95c01992-ff5c-4e98-8901-f90d2d9825c0	P16	frecuencia	3	2025-12-26 20:24:06.237453-06
1583	95c01992-ff5c-4e98-8901-f90d2d9825c0	P16	normalidad	3	2025-12-26 20:24:06.237453-06
1584	95c01992-ff5c-4e98-8901-f90d2d9825c0	P16	gravedad	3	2025-12-26 20:24:06.237453-06
1585	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P1	frecuencia	2	2025-12-26 20:26:26.732888-06
1586	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P1	normalidad	3	2025-12-26 20:26:26.732888-06
1587	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P1	gravedad	3	2025-12-26 20:26:26.732888-06
1588	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P2	frecuencia	3	2025-12-26 20:26:26.732888-06
1589	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P2	normalidad	4	2025-12-26 20:26:26.732888-06
1590	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P2	gravedad	3	2025-12-26 20:26:26.732888-06
1591	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P3	frecuencia	4	2025-12-26 20:26:26.732888-06
1592	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P3	normalidad	3	2025-12-26 20:26:26.732888-06
1593	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P3	gravedad	4	2025-12-26 20:26:26.732888-06
1594	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P4	frecuencia	4	2025-12-26 20:26:26.732888-06
1595	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P4	normalidad	3	2025-12-26 20:26:26.732888-06
1596	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P4	gravedad	4	2025-12-26 20:26:26.732888-06
1597	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P5	frecuencia	3	2025-12-26 20:26:26.732888-06
1598	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P5	normalidad	4	2025-12-26 20:26:26.732888-06
1599	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P5	gravedad	3	2025-12-26 20:26:26.732888-06
1600	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P6	frecuencia	4	2025-12-26 20:26:26.732888-06
1601	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P6	normalidad	3	2025-12-26 20:26:26.732888-06
1602	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P6	gravedad	5	2025-12-26 20:26:26.732888-06
1603	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P7	frecuencia	4	2025-12-26 20:26:26.732888-06
1604	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P7	normalidad	4	2025-12-26 20:26:26.732888-06
1605	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P7	gravedad	5	2025-12-26 20:26:26.732888-06
1606	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P8	frecuencia	5	2025-12-26 20:26:26.732888-06
1607	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P8	normalidad	4	2025-12-26 20:26:26.732888-06
1608	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P8	gravedad	3	2025-12-26 20:26:26.732888-06
1609	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P9	frecuencia	4	2025-12-26 20:26:26.732888-06
1610	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P9	normalidad	4	2025-12-26 20:26:26.732888-06
1611	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P9	gravedad	3	2025-12-26 20:26:26.732888-06
1612	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P10	frecuencia	3	2025-12-26 20:26:26.732888-06
1613	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P10	normalidad	5	2025-12-26 20:26:26.732888-06
1614	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P10	gravedad	4	2025-12-26 20:26:26.732888-06
1615	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P11	frecuencia	4	2025-12-26 20:26:26.732888-06
1616	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P11	normalidad	4	2025-12-26 20:26:26.732888-06
1617	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P11	gravedad	4	2025-12-26 20:26:26.732888-06
1618	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P12	frecuencia	3	2025-12-26 20:26:26.732888-06
1619	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P12	normalidad	5	2025-12-26 20:26:26.732888-06
1620	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P12	gravedad	4	2025-12-26 20:26:26.732888-06
1621	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P13	frecuencia	3	2025-12-26 20:26:26.732888-06
1622	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P13	normalidad	4	2025-12-26 20:26:26.732888-06
1623	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P13	gravedad	4	2025-12-26 20:26:26.732888-06
1624	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P14	frecuencia	5	2025-12-26 20:26:26.732888-06
1625	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P14	normalidad	4	2025-12-26 20:26:26.732888-06
1626	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P14	gravedad	5	2025-12-26 20:26:26.732888-06
1627	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P15	frecuencia	4	2025-12-26 20:26:26.732888-06
1628	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P15	normalidad	5	2025-12-26 20:26:26.732888-06
1629	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P15	gravedad	5	2025-12-26 20:26:26.732888-06
1630	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P16	frecuencia	2	2025-12-26 20:26:26.732888-06
1631	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P16	normalidad	4	2025-12-26 20:26:26.732888-06
1632	80b0ba11-92ea-4765-8eae-7d411ebfef0d	P16	gravedad	3	2025-12-26 20:26:26.732888-06
1633	8c9938e5-93ef-4641-ad3b-cd65023a8446	P1	frecuencia	4	2025-12-26 20:42:32.49386-06
1634	8c9938e5-93ef-4641-ad3b-cd65023a8446	P1	normalidad	3	2025-12-26 20:42:32.49386-06
1635	8c9938e5-93ef-4641-ad3b-cd65023a8446	P1	gravedad	4	2025-12-26 20:42:32.49386-06
1636	8c9938e5-93ef-4641-ad3b-cd65023a8446	P2	frecuencia	3	2025-12-26 20:42:32.49386-06
1637	8c9938e5-93ef-4641-ad3b-cd65023a8446	P2	normalidad	4	2025-12-26 20:42:32.49386-06
1638	8c9938e5-93ef-4641-ad3b-cd65023a8446	P2	gravedad	4	2025-12-26 20:42:32.49386-06
1639	8c9938e5-93ef-4641-ad3b-cd65023a8446	P3	frecuencia	4	2025-12-26 20:42:32.49386-06
1640	8c9938e5-93ef-4641-ad3b-cd65023a8446	P3	normalidad	3	2025-12-26 20:42:32.49386-06
1641	8c9938e5-93ef-4641-ad3b-cd65023a8446	P3	gravedad	4	2025-12-26 20:42:32.49386-06
1642	8c9938e5-93ef-4641-ad3b-cd65023a8446	P4	frecuencia	2	2025-12-26 20:42:32.49386-06
1643	8c9938e5-93ef-4641-ad3b-cd65023a8446	P4	normalidad	2	2025-12-26 20:42:32.49386-06
1644	8c9938e5-93ef-4641-ad3b-cd65023a8446	P4	gravedad	3	2025-12-26 20:42:32.49386-06
1645	8c9938e5-93ef-4641-ad3b-cd65023a8446	P5	frecuencia	4	2025-12-26 20:42:32.49386-06
1646	8c9938e5-93ef-4641-ad3b-cd65023a8446	P5	normalidad	3	2025-12-26 20:42:32.49386-06
1647	8c9938e5-93ef-4641-ad3b-cd65023a8446	P5	gravedad	4	2025-12-26 20:42:32.49386-06
1648	8c9938e5-93ef-4641-ad3b-cd65023a8446	P6	frecuencia	3	2025-12-26 20:42:32.49386-06
1649	8c9938e5-93ef-4641-ad3b-cd65023a8446	P6	normalidad	4	2025-12-26 20:42:32.49386-06
1650	8c9938e5-93ef-4641-ad3b-cd65023a8446	P6	gravedad	4	2025-12-26 20:42:32.49386-06
1651	8c9938e5-93ef-4641-ad3b-cd65023a8446	P7	frecuencia	4	2025-12-26 20:42:32.49386-06
1652	8c9938e5-93ef-4641-ad3b-cd65023a8446	P7	normalidad	4	2025-12-26 20:42:32.49386-06
1653	8c9938e5-93ef-4641-ad3b-cd65023a8446	P7	gravedad	3	2025-12-26 20:42:32.49386-06
1654	8c9938e5-93ef-4641-ad3b-cd65023a8446	P8	frecuencia	3	2025-12-26 20:42:32.49386-06
1655	8c9938e5-93ef-4641-ad3b-cd65023a8446	P8	normalidad	4	2025-12-26 20:42:32.49386-06
1656	8c9938e5-93ef-4641-ad3b-cd65023a8446	P8	gravedad	3	2025-12-26 20:42:32.49386-06
1657	8c9938e5-93ef-4641-ad3b-cd65023a8446	P9	frecuencia	5	2025-12-26 20:42:32.49386-06
1658	8c9938e5-93ef-4641-ad3b-cd65023a8446	P9	normalidad	4	2025-12-26 20:42:32.49386-06
1659	8c9938e5-93ef-4641-ad3b-cd65023a8446	P9	gravedad	4	2025-12-26 20:42:32.49386-06
1660	8c9938e5-93ef-4641-ad3b-cd65023a8446	P10	frecuencia	4	2025-12-26 20:42:32.49386-06
1661	8c9938e5-93ef-4641-ad3b-cd65023a8446	P10	normalidad	4	2025-12-26 20:42:32.49386-06
1662	8c9938e5-93ef-4641-ad3b-cd65023a8446	P10	gravedad	4	2025-12-26 20:42:32.49386-06
1663	8c9938e5-93ef-4641-ad3b-cd65023a8446	P11	frecuencia	3	2025-12-26 20:42:32.49386-06
1664	8c9938e5-93ef-4641-ad3b-cd65023a8446	P11	normalidad	2	2025-12-26 20:42:32.49386-06
1665	8c9938e5-93ef-4641-ad3b-cd65023a8446	P11	gravedad	3	2025-12-26 20:42:32.49386-06
1666	8c9938e5-93ef-4641-ad3b-cd65023a8446	P12	frecuencia	4	2025-12-26 20:42:32.49386-06
1667	8c9938e5-93ef-4641-ad3b-cd65023a8446	P12	normalidad	4	2025-12-26 20:42:32.49386-06
1668	8c9938e5-93ef-4641-ad3b-cd65023a8446	P12	gravedad	4	2025-12-26 20:42:32.49386-06
1669	8c9938e5-93ef-4641-ad3b-cd65023a8446	P13	frecuencia	3	2025-12-26 20:42:32.49386-06
1670	8c9938e5-93ef-4641-ad3b-cd65023a8446	P13	normalidad	4	2025-12-26 20:42:32.49386-06
1671	8c9938e5-93ef-4641-ad3b-cd65023a8446	P13	gravedad	3	2025-12-26 20:42:32.49386-06
1672	8c9938e5-93ef-4641-ad3b-cd65023a8446	P14	frecuencia	4	2025-12-26 20:42:32.49386-06
1673	8c9938e5-93ef-4641-ad3b-cd65023a8446	P14	normalidad	4	2025-12-26 20:42:32.49386-06
1674	8c9938e5-93ef-4641-ad3b-cd65023a8446	P14	gravedad	4	2025-12-26 20:42:32.49386-06
1675	8c9938e5-93ef-4641-ad3b-cd65023a8446	P15	frecuencia	5	2025-12-26 20:42:32.49386-06
1676	8c9938e5-93ef-4641-ad3b-cd65023a8446	P15	normalidad	4	2025-12-26 20:42:32.49386-06
1677	8c9938e5-93ef-4641-ad3b-cd65023a8446	P15	gravedad	4	2025-12-26 20:42:32.49386-06
1678	8c9938e5-93ef-4641-ad3b-cd65023a8446	P16	frecuencia	4	2025-12-26 20:42:32.49386-06
1679	8c9938e5-93ef-4641-ad3b-cd65023a8446	P16	normalidad	4	2025-12-26 20:42:32.49386-06
1680	8c9938e5-93ef-4641-ad3b-cd65023a8446	P16	gravedad	4	2025-12-26 20:42:32.49386-06
\.


--
-- Data for Name: usuario_centros; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario_centros (usuario_id, centro_id, created_at) FROM stdin;
ee0625a0-0b4b-494c-bf05-21ff2943f67a	1	2026-04-11 18:43:17.666002-06
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, email, nombre, rol, password_hash, activo, created_at, last_login_at) FROM stdin;
7bc47e64-9703-419b-a803-fca5de67dfba	romi@mail.com	Vidal Salazar	admin	$2a$06$9Cxcs.O3.tUY.ks1mUQWYOrEH4ocpZyTo38.aCAV5f5J6EuS1lDm2	t	2025-12-24 01:04:53.888319-06	2026-04-11 18:42:39.920047-06
ee0625a0-0b4b-494c-bf05-21ff2943f67a	upiita@mail.com	Romina Salazar	centro	$2a$10$2eWIVEhLWkIq0.y6SS/QJO3lMRenhWkNRdxVs.3Lp0JMzU9rIqwgq	t	2025-12-24 02:02:46.840428-06	2026-04-11 18:43:42.093066-06
\.


--
-- Name: centros_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.centros_id_seq', 2, true);


--
-- Name: generos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.generos_id_seq', 8, true);


--
-- Name: respuestas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.respuestas_id_seq', 1680, true);


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

\unrestrict J0NSxVx4uDkB0BHzXLINFztvx9aLTxpQT24VJzlVLP518F9AsMjuef8TZcbQysn

