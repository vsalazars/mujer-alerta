#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-mujer-back/.env}"
TOTAL="${TOTAL:-8980}"
BATCH="${BATCH:-200}"
YEAR="${YEAR:-2025}"
CENTRO_BUSQUEDA="${CENTRO_BUSQUEDA:-UPIITA}"
BORRAR_ANTES="${BORRAR_ANTES:-1}"
TOTAL_COMENTARIOS="${TOTAL_COMENTARIOS:-20}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL no está definida en $ENV_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no está instalado"
  exit 1
fi

CENTRO_ID="$(psql "$DATABASE_URL" -Atc "
  select id
  from centros
  where activo = true
    and nombre ilike '%${CENTRO_BUSQUEDA}%'
  order by id
  limit 1;
")"

if [[ -z "$CENTRO_ID" ]]; then
  echo "No encontré un centro activo con nombre parecido a: $CENTRO_BUSQUEDA"
  exit 1
fi

echo "Centro encontrado: ID=$CENTRO_ID"
echo "Total a insertar: $TOTAL"
echo "Tamaño de lote: $BATCH"
echo "Año: $YEAR"
echo "Comentarios a insertar: $TOTAL_COMENTARIOS"

if [[ "$BORRAR_ANTES" == "1" ]]; then
  echo "Borrando dataset previo del centro para el año $YEAR..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v centro_id="$CENTRO_ID" \
    -v year="$YEAR" <<'SQL'
update encuestas
set comentario = null
where centro_id = :'centro_id'::bigint
  and finished_at is not null
  and extract(year from finished_at) = :'year'::int;

delete from respuestas r
using encuestas e
where e.id = r.encuesta_id
  and e.centro_id = :'centro_id'::bigint
  and e.finished_at is not null
  and extract(year from e.finished_at) = :'year'::int;

delete from encuestas e
where e.centro_id = :'centro_id'::bigint
  and e.finished_at is not null
  and extract(year from e.finished_at) = :'year'::int;
SQL
fi

insert_batch() {
  local batch_size="$1"

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v centro_id="$CENTRO_ID" \
    -v batch_size="$batch_size" \
    -v year="$YEAR" <<'SQL'
with params as (
  select
    :'centro_id'::bigint as centro_id,
    :'batch_size'::int as batch_size,
    :'year'::int as year
),

genero_catalogo as (
  select id, clave
  from generos
  where activo = true
),

nuevas_encuestas as (
  insert into encuestas (
    instrumento_id,
    centro_id,
    email,
    genero_id,
    edad,
    consent,
    started_at,
    finished_at,
    created_at
  )
  select
    'mujer_alerta_v1',
    p.centro_id,
    null,

    (
      select gc.id
      from genero_catalogo gc
      cross join lateral (
        select random() as r
      ) x
      where
        (gc.clave = 'mujer' and x.r < 0.480)
        or (gc.clave = 'hombre' and x.r >= 0.480 and x.r < 0.950)
        or (gc.clave = 'prefiero_no_decir' and x.r >= 0.950 and x.r < 0.970)
        or (gc.clave = 'no_binaria' and x.r >= 0.970 and x.r < 0.980)
        or (gc.clave = 'trans' and x.r >= 0.980 and x.r < 0.987)
        or (gc.clave = 'genero_fluido' and x.r >= 0.987 and x.r < 0.992)
        or (gc.clave = 'agenero' and x.r >= 0.992 and x.r < 0.996)
        or (gc.clave = 'otra_identidad' and x.r >= 0.996 and x.r <= 1.000)
      limit 1
    ) as genero_id,

    (
      case
        when random() < 0.10 then 18
        when random() < 0.27 then 19
        when random() < 0.54 then 20
        when random() < 0.76 then 21
        when random() < 0.89 then 22
        when random() < 0.95 then 23
        when random() < 0.985 then 24
        else 25
      end
    )::smallint as edad,

    true,

    ts_base as started_at,
    ts_base + ((4 + floor(random() * 28))::text || ' minutes')::interval as finished_at,
    ts_base as created_at
  from params p
  cross join generate_series(1, p.batch_size)
  cross join lateral (
    select
      make_timestamp(p.year, 1, 1, 8, 0, 0)
      + (random() * interval '364 days')
      + (random() * interval '12 hours') as ts_base
  ) t
  returning id, genero_id, edad, finished_at
),

perfil_participante as (
  select
    e.id as encuesta_id,
    e.genero_id,
    e.edad,
    e.finished_at,
    case
      when random() < 0.10 then 1.8 + random() * 0.5
      when random() < 0.45 then 2.3 + random() * 0.7
      when random() < 0.82 then 3.0 + random() * 0.7
      else 3.7 + random() * 0.8
    end as base_level,
    (random() - 0.5) * 0.55 as person_noise,
    (random() - 0.5) * 0.35 as sens_freq,
    (random() - 0.5) * 0.30 as sens_norm,
    (random() - 0.5) * 0.35 as sens_grav,
    case
      when extract(month from e.finished_at) between 1 and 3 then -0.06
      when extract(month from e.finished_at) between 4 and 6 then 0.02
      when extract(month from e.finished_at) between 7 and 9 then 0.08
      else 0.03
    end as season_adj
  from nuevas_encuestas e
),

mapa_respuestas as (
  select *
  from (
    values
      ('P1',  1, 'frecuencia', 0.12),
      ('P1',  1, 'normalidad', 0.20),
      ('P1',  1, 'gravedad',   0.26),
      ('P2',  1, 'frecuencia', 0.14),
      ('P2',  1, 'normalidad', 0.22),
      ('P2',  1, 'gravedad',   0.30),
      ('P3',  2, 'frecuencia', 0.18),
      ('P3',  2, 'normalidad', 0.24),
      ('P3',  2, 'gravedad',   0.29),
      ('P4',  2, 'frecuencia', 0.16),
      ('P4',  2, 'normalidad', 0.23),
      ('P4',  2, 'gravedad',   0.30),
      ('P5',  3, 'frecuencia', 0.24),
      ('P5',  3, 'normalidad', 0.17),
      ('P5',  3, 'gravedad',   0.33),
      ('P6',  3, 'frecuencia', 0.23),
      ('P6',  3, 'normalidad', 0.16),
      ('P6',  3, 'gravedad',   0.29),
      ('P7',  4, 'frecuencia', 0.20),
      ('P7',  4, 'normalidad', 0.20),
      ('P7',  4, 'gravedad',   0.39),
      ('P8',  4, 'frecuencia', 0.19),
      ('P8',  4, 'normalidad', 0.19),
      ('P8',  4, 'gravedad',   0.38),
      ('P9',  5, 'frecuencia', 0.23),
      ('P9',  5, 'normalidad', 0.27),
      ('P9',  5, 'gravedad',   0.34),
      ('P10', 5, 'frecuencia', 0.25),
      ('P10', 5, 'normalidad', 0.28),
      ('P10', 5, 'gravedad',   0.36),
      ('P11', 6, 'frecuencia', 0.17),
      ('P11', 6, 'normalidad', 0.18),
      ('P11', 6, 'gravedad',   0.28),
      ('P12', 6, 'frecuencia', 0.18),
      ('P12', 6, 'normalidad', 0.18),
      ('P12', 6, 'gravedad',   0.28),
      ('P13', 7, 'frecuencia', 0.27),
      ('P13', 7, 'normalidad', 0.23),
      ('P13', 7, 'gravedad',   0.32),
      ('P14', 7, 'frecuencia', 0.28),
      ('P14', 7, 'normalidad', 0.24),
      ('P14', 7, 'gravedad',   0.33),
      ('P15', 8, 'frecuencia', 0.08),
      ('P15', 8, 'normalidad', 0.05),
      ('P15', 8, 'gravedad',   0.43),
      ('P16', 8, 'frecuencia', 0.07),
      ('P16', 8, 'normalidad', 0.05),
      ('P16', 8, 'gravedad',   0.45)
  ) as t(pregunta_id, tipo_num, dimension, tipo_bias)
),

respuestas_generadas as (
  select
    p.encuesta_id,
    m.pregunta_id,
    m.dimension,
    greatest(
      1,
      least(
        5,
        round(
          (
            p.base_level
            + p.person_noise
            + p.season_adj
            + m.tipo_bias
            + case m.dimension
                when 'frecuencia' then p.sens_freq - 0.02
                when 'normalidad' then p.sens_norm + 0.10
                when 'gravedad' then p.sens_grav + 0.20
                else 0
              end
            + case
                when p.edad = 18 and m.dimension = 'normalidad' then 0.08
                when p.edad in (19,20,21) and m.dimension = 'frecuencia' then 0.05
                when p.edad in (22,23,24,25) and m.dimension = 'gravedad' then 0.08
                else 0
              end
            + case
                when random() < 0.05 then 0.9
                when random() < 0.12 then -0.8
                else (random() - 0.5) * 0.75
              end
          )::numeric,
          0
        )
      )
    )::smallint as valor,
    p.finished_at as created_at
  from perfil_participante p
  join mapa_respuestas m on true
)

insert into respuestas (
  encuesta_id,
  pregunta_id,
  dimension,
  valor,
  created_at
)
select
  encuesta_id,
  pregunta_id,
  dimension::dimension_enum,
  valor,
  created_at
from respuestas_generadas;
SQL
}

insert_comments() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v centro_id="$CENTRO_ID" \
    -v year="$YEAR" \
    -v total_comments="$TOTAL_COMENTARIOS" <<'SQL'
with comentarios_pool as (
  select *
  from (
    values
      (1,  'En algunas clases todavia se hacen bromas sobre que ciertas carreras son mas para hombres y eso incomoda bastante.'),
      (2,  'He visto que cuando una alumna participa varias veces, algunas personas la califican de intensa, mientras que a los hombres no les dicen lo mismo.'),
      (3,  'En equipos de trabajo a veces se les asignan tareas administrativas a las mujeres y a los hombres la parte tecnica.'),
      (4,  'No es algo que pase siempre, pero si se nota que algunos comentarios sobre apariencia fisica se han normalizado demasiado.'),
      (5,  'Hay profesores que si corrigen con respeto, pero entre estudiantes luego circulan chistes sexistas como si fueran normales.'),
      (6,  'En laboratorios y proyectos algunas companeras sienten que tienen que demostrar el doble para que confien en su trabajo.'),
      (7,  'Seria bueno que hubiera mas difusion de rutas de apoyo y denuncia porque mucha gente no sabe a quien acudir.'),
      (8,  'A veces los comentarios no parecen graves por separado, pero acumulados si generan un ambiente pesado para las alumnas.'),
      (9,  'He escuchado frases como que una mujer obtuvo algo por su apariencia y no por su capacidad, y eso deberia frenarse de inmediato.'),
      (10, 'En redes y grupos de mensajeria tambien llegan a compartirse memes o capturas que incomodan, aunque casi nadie lo reporta.'),
      (11, 'Creo que el problema principal es la normalizacion, porque muchas conductas se minimizan con la idea de que son bromas.'),
      (12, 'Tambien hay docentes y estudiantes que si intervienen cuando ven algo injusto, y eso hace diferencia en el ambiente.'),
      (13, 'Me parece importante trabajar la sensibilizacion desde primer semestre para que no se repitan patrones de discriminacion.'),
      (14, 'No todo el entorno es hostil, pero si existen actitudes sutiles que terminan excluyendo o desvalorizando a varias companeras.'),
      (15, 'En algunas actividades se sigue esperando que las mujeres sean mas calladas o conciliadoras, y eso limita mucho la participacion.'),
      (16, 'Cuando sucede un comentario ofensivo, muchas veces nadie dice nada y eso hace que la persona que lo recibe se quede sola.'),
      (17, 'Seria util que hubiera talleres obligatorios sobre violencia digital, acoso y formas de apoyo dentro de la escuela.'),
      (18, 'He notado que algunas alumnas prefieren no opinar en publico para evitar burlas o que cuestionen sus conocimientos.'),
      (19, 'Hay avances en comparacion con antes, pero todavia faltan acciones claras para prevenir y atender estas situaciones.'),
      (20, 'El respeto depende mucho del grupo y del profesor, porque en unos espacios se siente seguridad y en otros no tanto.')
  ) as t(orden, comentario)
),

encuestas_objetivo as (
  select e.id, row_number() over (order by random()) as rn
  from encuestas e
  where e.centro_id = :'centro_id'::bigint
    and e.finished_at is not null
    and extract(year from e.finished_at) = :'year'::int
  order by random()
  limit :'total_comments'::int
)

update encuestas e
set comentario = c.comentario
from encuestas_objetivo eo
join comentarios_pool c on c.orden = eo.rn
where e.id = eo.id;
SQL
}

done_count=0
while [[ "$done_count" -lt "$TOTAL" ]]; do
  remaining=$((TOTAL - done_count))
  current_batch=$BATCH
  if [[ "$remaining" -lt "$BATCH" ]]; then
    current_batch=$remaining
  fi

  echo "Insertando lote de $current_batch participantes..."
  insert_batch "$current_batch"
  done_count=$((done_count + current_batch))
  echo "Progreso: $done_count / $TOTAL"
done

echo "Insertando comentarios..."
insert_comments

echo
echo "Verificación final:"
psql "$DATABASE_URL" -c "
select count(*) as encuestas_2025
from encuestas
where centro_id = $CENTRO_ID
  and finished_at is not null
  and extract(year from finished_at) = $YEAR;
"

psql "$DATABASE_URL" -c "
select
  g.etiqueta as genero,
  count(*) as total
from encuestas e
join generos g on g.id = e.genero_id
where e.centro_id = $CENTRO_ID
  and e.finished_at is not null
  and extract(year from e.finished_at) = $YEAR
group by g.etiqueta
order by total desc, genero asc;
"

psql "$DATABASE_URL" -c "
select edad, count(*) as total
from encuestas
where centro_id = $CENTRO_ID
  and finished_at is not null
  and extract(year from finished_at) = $YEAR
group by edad
order by edad;
"

psql "$DATABASE_URL" -c "
select count(*) as comentarios
from encuestas
where centro_id = $CENTRO_ID
  and finished_at is not null
  and extract(year from finished_at) = $YEAR
  and comentario is not null
  and btrim(comentario) <> '';
"

psql "$DATABASE_URL" -c "
select
  round(avg(case when r.dimension='frecuencia' then r.valor end), 2) as frecuencia,
  round(avg(case when r.dimension='normalidad' then r.valor end), 2) as normalidad,
  round(avg(case when r.dimension='gravedad' then r.valor end), 2) as gravedad,
  round(avg(r.valor), 2) as total
from respuestas r
join encuestas e on e.id = r.encuesta_id
where e.centro_id = $CENTRO_ID
  and e.finished_at is not null
  and extract(year from e.finished_at) = $YEAR;
"

psql "$DATABASE_URL" -c "
select
  to_char(finished_at, 'YYYY-MM-DD HH24:MI') as fecha,
  edad,
  comentario
from encuestas
where centro_id = $CENTRO_ID
  and finished_at is not null
  and extract(year from finished_at) = $YEAR
  and comentario is not null
  and btrim(comentario) <> ''
order by finished_at desc
limit 20;
"
