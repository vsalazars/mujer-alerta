--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: dimension_enum; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.dimension_enum AS ENUM (
    'frecuencia',
    'normalidad',
    'gravedad'
);


ALTER TYPE public.dimension_enum OWNER TO vsalazars;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: centros; Type: TABLE; Schema: public; Owner: vsalazars
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


ALTER TABLE public.centros OWNER TO vsalazars;

--
-- Name: centros_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.centros_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.centros_id_seq OWNER TO vsalazars;

--
-- Name: centros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.centros_id_seq OWNED BY public.centros.id;


--
-- Name: encuestas; Type: TABLE; Schema: public; Owner: vsalazars
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
    CONSTRAINT encuestas_edad_check CHECK (((edad >= 10) AND (edad <= 120)))
);


ALTER TABLE public.encuestas OWNER TO vsalazars;

--
-- Name: generos; Type: TABLE; Schema: public; Owner: vsalazars
--

CREATE TABLE public.generos (
    id bigint NOT NULL,
    clave text NOT NULL,
    etiqueta text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.generos OWNER TO vsalazars;

--
-- Name: generos_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.generos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.generos_id_seq OWNER TO vsalazars;

--
-- Name: generos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.generos_id_seq OWNED BY public.generos.id;


--
-- Name: respuestas; Type: TABLE; Schema: public; Owner: vsalazars
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


ALTER TABLE public.respuestas OWNER TO vsalazars;

--
-- Name: respuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.respuestas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.respuestas_id_seq OWNER TO vsalazars;

--
-- Name: respuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.respuestas_id_seq OWNED BY public.respuestas.id;


--
-- Name: v_encuestas_conteo_respuestas; Type: VIEW; Schema: public; Owner: vsalazars
--

CREATE VIEW public.v_encuestas_conteo_respuestas AS
 SELECT e.id AS encuesta_id,
    e.centro_id,
    count(r.id) AS total_respuestas
   FROM (public.encuestas e
     LEFT JOIN public.respuestas r ON ((r.encuesta_id = e.id)))
  GROUP BY e.id, e.centro_id;


ALTER VIEW public.v_encuestas_conteo_respuestas OWNER TO vsalazars;

--
-- Name: v_matriz_tipo_dimension; Type: VIEW; Schema: public; Owner: vsalazars
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


ALTER VIEW public.v_matriz_tipo_dimension OWNER TO vsalazars;

--
-- Name: centros id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.centros ALTER COLUMN id SET DEFAULT nextval('public.centros_id_seq'::regclass);


--
-- Name: generos id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.generos ALTER COLUMN id SET DEFAULT nextval('public.generos_id_seq'::regclass);


--
-- Name: respuestas id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.respuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_id_seq'::regclass);


--
-- Data for Name: centros; Type: TABLE DATA; Schema: public; Owner: vsalazars
--

COPY public.centros (id, tipo, nombre, clave, ciudad, estado, activo, created_at) FROM stdin;
1	escolar	Centro de prueba	\N	\N	\N	t	2025-12-22 22:31:26.985374-06
\.


--
-- Data for Name: encuestas; Type: TABLE DATA; Schema: public; Owner: vsalazars
--

COPY public.encuestas (id, instrumento_id, centro_id, email, email_hash, genero_id, edad, consent, started_at, finished_at, created_at) FROM stdin;
62a98d2d-761a-40d4-b2b5-744cabd9153b	mujer_alerta_v1	1	test@ejemplo.com	\N	1	22	t	2025-12-22 22:32:49.284654-06	\N	2025-12-22 22:32:49.284654-06
223e0ba1-e2e1-4f10-a6cb-a615ccecff33	mujer_alerta_v1	1	\N	\N	3	19	t	2025-12-22 23:10:43.090838-06	\N	2025-12-22 23:10:43.090838-06
678b0a0c-74db-4fb7-aa51-52856f8c4a95	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-22 23:14:05.239067-06	\N	2025-12-22 23:14:05.239067-06
9238a6aa-c264-4e63-9cd6-a52574a14ba7	mujer_alerta_v1	1	\N	\N	2	21	t	2025-12-22 23:14:44.097778-06	\N	2025-12-22 23:14:44.097778-06
9c31004e-5880-4128-b359-b3db66c38ddb	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-22 23:18:34.10518-06	\N	2025-12-22 23:18:34.10518-06
f589cd47-3c0e-4db9-a03f-dbf62387755b	mujer_alerta_v1	1	\N	\N	2	15	t	2025-12-22 23:19:27.124499-06	\N	2025-12-22 23:19:27.124499-06
7ddaa0a6-dac7-4064-94db-61bfad03c512	mujer_alerta_v1	1	\N	\N	1	12	t	2025-12-22 23:20:32.488212-06	\N	2025-12-22 23:20:32.488212-06
d672471d-b9ff-4bfa-a6b9-b2f995696bf4	mujer_alerta_v1	1	\N	\N	2	15	t	2025-12-22 23:24:16.440321-06	\N	2025-12-22 23:24:16.440321-06
7dfd62ca-f6d8-4961-b927-dfd3e93fa2bb	mujer_alerta_v1	1	\N	\N	1	20	t	2025-12-22 23:26:19.935988-06	\N	2025-12-22 23:26:19.935988-06
7bceedef-6760-4f4f-8b1f-eb6bb35c8821	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-22 23:29:08.128294-06	\N	2025-12-22 23:29:08.128294-06
0c195731-23e4-4b51-a8fb-ccc2341c89f4	mujer_alerta_v1	1	\N	\N	3	56	t	2025-12-22 23:31:18.390708-06	\N	2025-12-22 23:31:18.390708-06
5ed565bc-991e-430e-877f-63f38ec7765e	mujer_alerta_v1	1	\N	\N	3	12	t	2025-12-22 23:32:39.68451-06	\N	2025-12-22 23:32:39.68451-06
f7aa84c8-fe1c-4bb4-b985-3045b54fd28f	mujer_alerta_v1	1	\N	\N	2	20	t	2025-12-22 23:48:28.806097-06	\N	2025-12-22 23:48:28.806097-06
7131bcfd-fdf4-481c-8ddf-e9344efbed87	mujer_alerta_v1	1	\N	\N	2	78	t	2025-12-22 23:54:02.846749-06	\N	2025-12-22 23:54:02.846749-06
cc8e12f2-b96e-4a8d-835e-29e2d1a07a1a	mujer_alerta_v1	1	\N	\N	2	78	t	2025-12-22 23:57:21.980057-06	\N	2025-12-22 23:57:21.980057-06
8334e638-51c0-471c-8118-9b9cf55f1cbd	mujer_alerta_v1	1	\N	\N	4	12	t	2025-12-23 00:40:40.530105-06	\N	2025-12-23 00:40:40.530105-06
a1ff5612-30c0-481d-af9b-2a563871869d	mujer_alerta_v1	1	\N	\N	3	20	t	2025-12-23 00:42:29.836692-06	\N	2025-12-23 00:42:29.836692-06
e2ed95c3-b74f-4a5c-ad9d-e712f66fad47	mujer_alerta_v1	1	\N	\N	2	34	t	2025-12-23 01:03:05.111933-06	\N	2025-12-23 01:03:05.111933-06
2af03b0f-91a2-4c09-baaf-46ccd0749197	mujer_alerta_v1	1	\N	\N	3	45	t	2025-12-23 01:06:03.89115-06	\N	2025-12-23 01:06:03.89115-06
78a23e73-19cd-4cff-ab6c-1acceff73e66	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-23 01:15:00.378044-06	\N	2025-12-23 01:15:00.378044-06
f06036f1-b0a7-41ae-b186-6d5d0b56d55f	mujer_alerta_v1	1	\N	\N	2	45	t	2025-12-23 01:36:24.143043-06	\N	2025-12-23 01:36:24.143043-06
c9d3c582-4bc7-4e07-bb85-cf9097587be3	mujer_alerta_v1	1	\N	\N	3	78	t	2025-12-23 01:37:53.549901-06	\N	2025-12-23 01:37:53.549901-06
6e02bcfc-e3a1-4cae-9773-69dfef549f41	mujer_alerta_v1	1	\N	\N	2	41	t	2025-12-23 02:11:31.924268-06	\N	2025-12-23 02:11:31.924268-06
8e5a2cb7-02c7-45c8-a3ea-5b9d35e5f265	mujer_alerta_v1	1	\N	\N	2	42	t	2025-12-23 02:26:04.421257-06	\N	2025-12-23 02:26:04.421257-06
9ee4b8c8-b41d-475d-930c-2f83b32c4261	mujer_alerta_v1	1	\N	\N	3	78	t	2025-12-23 02:27:32.931278-06	\N	2025-12-23 02:27:32.931278-06
48f326d0-71e0-45f5-984e-77fb81133b9d	mujer_alerta_v1	1	\N	\N	2	56	t	2025-12-23 02:42:41.600951-06	\N	2025-12-23 02:42:41.600951-06
56222357-bef0-40db-9c3b-b2e93520fc01	mujer_alerta_v1	1	\N	\N	2	18	t	2025-12-23 15:59:15.693591-06	\N	2025-12-23 15:59:15.693591-06
\.


--
-- Data for Name: generos; Type: TABLE DATA; Schema: public; Owner: vsalazars
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
-- Data for Name: respuestas; Type: TABLE DATA; Schema: public; Owner: vsalazars
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
\.


--
-- Name: centros_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vsalazars
--

SELECT pg_catalog.setval('public.centros_id_seq', 1, true);


--
-- Name: generos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vsalazars
--

SELECT pg_catalog.setval('public.generos_id_seq', 8, true);


--
-- Name: respuestas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vsalazars
--

SELECT pg_catalog.setval('public.respuestas_id_seq', 1056, true);


--
-- Name: centros centros_clave_key; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_clave_key UNIQUE (clave);


--
-- Name: centros centros_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.centros
    ADD CONSTRAINT centros_pkey PRIMARY KEY (id);


--
-- Name: encuestas encuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_pkey PRIMARY KEY (id);


--
-- Name: generos generos_clave_key; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.generos
    ADD CONSTRAINT generos_clave_key UNIQUE (clave);


--
-- Name: generos generos_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.generos
    ADD CONSTRAINT generos_pkey PRIMARY KEY (id);


--
-- Name: respuestas respuestas_encuesta_id_pregunta_id_dimension_key; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_encuesta_id_pregunta_id_dimension_key UNIQUE (encuesta_id, pregunta_id, dimension);


--
-- Name: respuestas respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_pkey PRIMARY KEY (id);


--
-- Name: idx_centros_nombre; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_centros_nombre ON public.centros USING gin (to_tsvector('spanish'::regconfig, nombre));


--
-- Name: idx_centros_tipo; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_centros_tipo ON public.centros USING btree (tipo);


--
-- Name: idx_encuestas_centro; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_encuestas_centro ON public.encuestas USING btree (centro_id);


--
-- Name: idx_encuestas_email_hash; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_encuestas_email_hash ON public.encuestas USING btree (email_hash);


--
-- Name: idx_encuestas_instrumento; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_encuestas_instrumento ON public.encuestas USING btree (instrumento_id);


--
-- Name: idx_respuestas_encuesta; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_respuestas_encuesta ON public.respuestas USING btree (encuesta_id);


--
-- Name: idx_respuestas_preg_dim; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX idx_respuestas_preg_dim ON public.respuestas USING btree (pregunta_id, dimension);


--
-- Name: encuestas encuestas_centro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_centro_id_fkey FOREIGN KEY (centro_id) REFERENCES public.centros(id) ON DELETE RESTRICT;


--
-- Name: encuestas encuestas_genero_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_genero_id_fkey FOREIGN KEY (genero_id) REFERENCES public.generos(id);


--
-- Name: respuestas respuestas_encuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

