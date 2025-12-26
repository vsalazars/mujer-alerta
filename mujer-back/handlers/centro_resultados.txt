package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CentroResultadosHandler struct {
	DB *pgxpool.Pool
}

type CountItem struct {
	Clave string `json:"clave"`
	Label string `json:"label"`
	Total int64  `json:"total"`
}

/* ✅ NUEVO: promedios 1–5 por género para barras apiladas */
type GeneroDimItem struct {
	Clave      string  `json:"clave"`
	Label      string  `json:"label"`
	Frecuencia float64 `json:"frecuencia"`
	Normalidad float64 `json:"normalidad"`
	Gravedad   float64 `json:"gravedad"`
}

/* ✅ NUEVO: comentario tal cual en encuestas.comentario */
type ComentarioItem struct {
	EncuestaID string `json:"encuesta_id"`
	Fecha      string `json:"fecha"`  // string ISO simple
	Genero     string `json:"genero"` // etiqueta de generos
	Edad       int    `json:"edad"`
	Texto      string `json:"texto"`
}

type CentroStats struct {
	TotalParticipantes  int64       `json:"total_participantes"`
	TotalEncuestas      int64       `json:"total_encuestas"`
	TotalRespuestas     int64       `json:"total_respuestas"`
	EncuestasPorGenero  []CountItem `json:"encuestas_por_genero"`
	RespuestasPorGenero []CountItem `json:"respuestas_por_genero"`
	EncuestasPorEdad    []CountItem `json:"encuestas_por_edad"`
	RespuestasPorEdad   []CountItem `json:"respuestas_por_edad"`

	/* ✅ NUEVO */
	ResumenPorGenero []GeneroDimItem `json:"resumen_por_genero"`

	/* ✅ NUEVO: TODOS los comentarios */
	Comentarios []ComentarioItem `json:"comentarios"`
}

type CentroResumenResponse struct {
	Centros []int64       `json:"centros"`
	Global  ResumenGlobal `json:"global"`
	Matriz  []MatrizItem  `json:"matriz"`
	Stats   CentroStats   `json:"stats"`
}

/* ✅ NUEVO: years disponibles para selector */
type CentroYearsResponse struct {
	Years []int `json:"years"`
}

func writeJSONCentro(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h CentroResultadosHandler) ensureCentroRole(w http.ResponseWriter, r *http.Request) bool {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	return true
}

// GET /api/centro/resumen
// ✅ Nuevo: ?year=2025 (filtra por EXTRACT(YEAR FROM e.finished_at))
// ✅ Solo encuestas finalizadas (e.finished_at IS NOT NULL) cuando se usa el endpoint
func (h CentroResultadosHandler) GetResumenCentro(w http.ResponseWriter, r *http.Request) {
	if !h.ensureCentroRole(w, r) {
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	// ==========================
	// ✅ NUEVO: year opcional (?year=2025)
	// ==========================
	var year *int
	if ys := r.URL.Query().Get("year"); ys != "" {
		yi, err := strconv.Atoi(ys)
		if err != nil {
			http.Error(w, "bad_year", http.StatusBadRequest)
			return
		}
		year = &yi
	}

	// ==========================
	// STATS CORRECTAS (JOIN + DISTINCT)
	// ==========================
	var totalParticipantes int64
	var totalRespuestas int64

	// participantes = encuestas (finalizadas) con al menos 1 respuesta
	if err := h.DB.QueryRow(ctx, `
		select count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&totalParticipantes); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// total respuestas (solo finalizadas)
	if err := h.DB.QueryRow(ctx, `
		select count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&totalRespuestas); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if totalRespuestas == 0 {
		http.Error(w, "no_data", http.StatusNotFound)
		return
	}

	stats := CentroStats{
		TotalParticipantes:  totalParticipantes,
		TotalEncuestas:      totalParticipantes, // en tu modelo: 1 encuesta = 1 participante
		TotalRespuestas:     totalRespuestas,
		EncuestasPorGenero:  []CountItem{},
		RespuestasPorGenero: []CountItem{},
		EncuestasPorEdad:    []CountItem{},
		RespuestasPorEdad:   []CountItem{},

		/* ✅ NUEVO */
		ResumenPorGenero: []GeneroDimItem{},

		/* ✅ NUEVO */
		Comentarios: []ComentarioItem{},
	}

	// ==========================
	// GLOBAL POR DIMENSIÓN
	// ==========================
	var g ResumenGlobal
	rows, err := h.DB.Query(ctx, `
		select r.dimension::text, avg(r.valor)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by r.dimension
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var dim string
		var avg float64
		if err := rows.Scan(&dim, &avg); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		switch dim {
		case "frecuencia":
			g.Frecuencia = avg
		case "normalidad":
			g.Normalidad = avg
		case "gravedad":
			g.Gravedad = avg
		}
	}

	if err := h.DB.QueryRow(ctx, `
		select avg(r.valor)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&g.Total); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// ==========================
	// MATRIZ POR TIPO + DIMENSIÓN
	// ==========================
	mrows, err := h.DB.Query(ctx, `
		with mapa as (
			select * from (values
				('P1',1),('P2',1),
				('P3',2),('P4',2),
				('P5',3),('P6',3),
				('P7',4),('P8',4),
				('P9',5),('P10',5),
				('P11',6),('P12',6),
				('P13',7),('P14',7),
				('P15',8),('P16',8)
			) as t(pregunta_id, tipo_num)
		),
		tipos as (
			select * from (values
				(1,'Descalificación / Humillación'),
				(2,'Discriminación por ser mujer'),
				(3,'Sexualización / Comentarios sexuales'),
				(4,'Hostigamiento sexual'),
				(5,'Abuso de poder'),
				(6,'Obstaculización académica o laboral'),
				(7,'Violencia digital / mediática'),
				(8,'Agresión o amenaza')
			) as t(tipo_num, tipo_nombre)
		)
		select
			t.tipo_num,
			t.tipo_nombre,
			r.dimension::text,
			round(avg(r.valor)::numeric,2)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join mapa m on m.pregunta_id = r.pregunta_id
		join tipos t on t.tipo_num = m.tipo_num
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by t.tipo_num, t.tipo_nombre, r.dimension
		order by t.tipo_num, r.dimension
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer mrows.Close()

	matriz := []MatrizItem{}
	for mrows.Next() {
		var it MatrizItem
		if err := mrows.Scan(&it.TipoNum, &it.TipoNombre, &it.Dimension, &it.Promedio); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		matriz = append(matriz, it)
	}

	// ==========================
	// POR GÉNERO (REAL)
	// ==========================
	gr, _ := h.DB.Query(ctx, `
		select g.clave, g.etiqueta, count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by count(*) desc
	`, centros, year)
	for gr.Next() {
		var it CountItem
		gr.Scan(&it.Clave, &it.Label, &it.Total)
		stats.EncuestasPorGenero = append(stats.EncuestasPorGenero, it)
	}
	gr.Close()

	gr2, _ := h.DB.Query(ctx, `
		select g.clave, g.etiqueta, count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by count(*) desc
	`, centros, year)
	for gr2.Next() {
		var it CountItem
		gr2.Scan(&it.Clave, &it.Label, &it.Total)
		stats.RespuestasPorGenero = append(stats.RespuestasPorGenero, it)
	}
	gr2.Close()

	// ==========================
	// ✅ NUEVO: PROMEDIOS POR GÉNERO (Frecuencia/Normalidad/Gravedad)
	// ==========================
	gdRows, err := h.DB.Query(ctx, `
		select
			g.clave,
			g.etiqueta,
			coalesce(avg(case when r.dimension = 'frecuencia' then r.valor end), 0)::float8 as frecuencia,
			coalesce(avg(case when r.dimension = 'normalidad' then r.valor end), 0)::float8 as normalidad,
			coalesce(avg(case when r.dimension = 'gravedad' then r.valor end), 0)::float8 as gravedad
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by g.etiqueta asc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	for gdRows.Next() {
		var it GeneroDimItem
		if err := gdRows.Scan(&it.Clave, &it.Label, &it.Frecuencia, &it.Normalidad, &it.Gravedad); err != nil {
			gdRows.Close()
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.ResumenPorGenero = append(stats.ResumenPorGenero, it)
	}
	gdRows.Close()

	// ==========================
	// POR EDAD
	// ==========================
	edadKey := `e.edad::text`

	qEdadEnc := fmt.Sprintf(`
		select %s as clave, %s as label, count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by 1,2
		order by count(*) desc
	`, edadKey, edadKey)

	er, _ := h.DB.Query(ctx, qEdadEnc, centros, year)
	for er.Next() {
		var it CountItem
		er.Scan(&it.Clave, &it.Label, &it.Total)
		stats.EncuestasPorEdad = append(stats.EncuestasPorEdad, it)
	}
	er.Close()

	qEdadResp := fmt.Sprintf(`
		select %s as clave, %s as label, count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by 1,2
		order by count(*) desc
	`, edadKey, edadKey)

	er2, _ := h.DB.Query(ctx, qEdadResp, centros, year)
	for er2.Next() {
		var it CountItem
		er2.Scan(&it.Clave, &it.Label, &it.Total)
		stats.RespuestasPorEdad = append(stats.RespuestasPorEdad, it)
	}
	er2.Close()

	// ==========================
	// ✅ NUEVO: TODOS LOS COMENTARIOS (sin LIMIT)
	// ==========================
	cRows, err := h.DB.Query(ctx, `
		select
			e.id::text,
			to_char(e.finished_at, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha,
			coalesce(g.etiqueta, '') as genero,
			coalesce(e.edad, 0) as edad,
			e.comentario
		from encuestas e
		left join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		  and e.comentario is not null
		  and btrim(e.comentario) <> ''
		order by e.finished_at desc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer cRows.Close()

	for cRows.Next() {
		var it ComentarioItem
		if err := cRows.Scan(&it.EncuestaID, &it.Fecha, &it.Genero, &it.Edad, &it.Texto); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.Comentarios = append(stats.Comentarios, it)
	}
	if err := cRows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// ==========================
	// RESPONSE FINAL
	// ==========================
	resp := CentroResumenResponse{
		Centros: centros,
		Global:  g,
		Matriz:  matriz,
		Stats:   stats,
	}

	writeJSONCentro(w, http.StatusOK, resp)
}

// =======================================================
// ✅ NUEVO ENDPOINT: years disponibles (solo años con datos)
// GET /api/centro/years
// - usa los mismos centros del ctx
// - solo encuestas finalizadas (finished_at is not null)
// - devuelve { years: [2025, 2024, ...] }
// =======================================================
func (h CentroResultadosHandler) GetCentroYears(w http.ResponseWriter, r *http.Request) {
	if !h.ensureCentroRole(w, r) {
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	rows, err := h.DB.Query(ctx, `
		select distinct extract(year from e.finished_at)::int as year
		from encuestas e
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		order by year desc
	`, centros)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	years := make([]int, 0, 8)
	for rows.Next() {
		var y int
		if err := rows.Scan(&y); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		years = append(years, y)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroYearsResponse{Years: years})
}
