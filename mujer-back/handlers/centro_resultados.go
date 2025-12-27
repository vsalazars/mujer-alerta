package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"


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



// ✅ NUEVO: Serie anual para comparar años
// GET /api/centro/resumen-anual?years=2022,2023,2024
type CentroAnualPoint struct {
	Year        int     `json:"year"`
	Frecuencia  float64 `json:"frecuencia"`
	Normalidad  float64 `json:"normalidad"`
	Gravedad    float64 `json:"gravedad"`
	Total       float64 `json:"total"`
	Encuestas   int64   `json:"encuestas"`  // encuestas finalizadas con al menos 1 respuesta
	Respuestas  int64   `json:"respuestas"` // total respuestas
}

type CentroResumenAnualResponse struct {
	Centros []int64            `json:"centros"`
	Series  []CentroAnualPoint `json:"series"`
}

func (h CentroResultadosHandler) GetResumenCentroAnual(w http.ResponseWriter, r *http.Request) {
	if !h.ensureCentroRole(w, r) {
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	// years opcional: "2022,2023,2024"
	var years []int
	if ys := r.URL.Query().Get("years"); ys != "" {
		parts := strings.Split(ys, ",")
		years = make([]int, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			y, err := strconv.Atoi(p)
			if err != nil {
				http.Error(w, "bad_years", http.StatusBadRequest)
				return
			}
			years = append(years, y)
		}
		if len(years) == 0 {
			http.Error(w, "bad_years", http.StatusBadRequest)
			return
		}
	}

	// Si no mandan years, devolvemos todos los years disponibles (mismo criterio que /years)
	// y con eso generamos serie completa.
	if len(years) == 0 {
		rows, err := h.DB.Query(ctx, `
			select distinct extract(year from e.finished_at)::int as year
			from encuestas e
			where e.centro_id = any($1::bigint[])
			  and e.finished_at is not null
			order by year asc
		`, centros)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		for rows.Next() {
			var y int
			if err := rows.Scan(&y); err != nil {
				rows.Close()
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			years = append(years, y)
		}
		rows.Close()
	}

	// ==========================
	// Query: promedios por año (pivot por dimensión)
	// ==========================
	// Nota: filtramos por years con ANY($2::int[]) si years viene.
	// Si years viene vacío (no debería ya), igual regresaría todos.
	rows, err := h.DB.Query(ctx, `
		with base as (
			select
				extract(year from e.finished_at)::int as year,
				r.dimension::text as dimension,
				r.valor::float8 as valor
			from respuestas r
			join encuestas e on e.id = r.encuesta_id
			where e.centro_id = any($1::bigint[])
			  and e.finished_at is not null
			  and (
					cardinality($2::int[]) = 0
					or extract(year from e.finished_at)::int = any($2::int[])
			  )
		),
		avg_dims as (
			select
				year,
				avg(case when dimension = 'frecuencia' then valor end)::float8 as frecuencia,
				avg(case when dimension = 'normalidad' then valor end)::float8 as normalidad,
				avg(case when dimension = 'gravedad' then valor end)::float8 as gravedad,
				avg(valor)::float8 as total
			from base
			group by year
		),
		cnt as (
			select
				extract(year from e.finished_at)::int as year,
				count(distinct e.id) as encuestas,
				count(r.*) as respuestas
			from encuestas e
			join respuestas r on r.encuesta_id = e.id
			where e.centro_id = any($1::bigint[])
			  and e.finished_at is not null
			  and (
					cardinality($2::int[]) = 0
					or extract(year from e.finished_at)::int = any($2::int[])
			  )
			group by extract(year from e.finished_at)::int
		)
		select
			a.year,
			coalesce(a.frecuencia, 0)::float8,
			coalesce(a.normalidad, 0)::float8,
			coalesce(a.gravedad, 0)::float8,
			coalesce(a.total, 0)::float8,
			coalesce(c.encuestas, 0)::bigint,
			coalesce(c.respuestas, 0)::bigint
		from avg_dims a
		left join cnt c on c.year = a.year
		order by a.year asc
	`, centros, years)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	series := make([]CentroAnualPoint, 0, len(years))
	for rows.Next() {
		var p CentroAnualPoint
		if err := rows.Scan(&p.Year, &p.Frecuencia, &p.Normalidad, &p.Gravedad, &p.Total, &p.Encuestas, &p.Respuestas); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		series = append(series, p)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// Si no hay nada, regresa 404 para que el front lo trate como "sin datos"
	if len(series) == 0 {
		http.Error(w, "no_data", http.StatusNotFound)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroResumenAnualResponse{
		Centros: centros,
		Series:  series,
	})
}


// =======================================================
// 📊 ESTADÍSTICA AVANZADA POR CENTRO Y AÑO
// Incluye:
// 1️⃣ Desviación estándar (ítems) + desviación estándar entre encuestas
// 2️⃣ Mediana + percentiles (P25, P75) (por ítems)
// 3️⃣ Tamaño muestral explícito (por dimensión + total anual + k)
// 4️⃣ Intervalos de confianza 95% (ítems + encuestas)
// 5️⃣ Alpha de Cronbach (consistencia interna) por dimensión
// =======================================================

type EstadisticaDimension struct {
	Dimension string `json:"dimension"`

	// ✅ tamaños muestrales
	NRespuestas     int64 `json:"n_respuestas"`      // por dimensión (ej. 112 = 7*16)
	NEncuestas      int64 `json:"n_encuestas"`       // encuestas finalizadas (ej. 7)
	TotalRespuestas int64 `json:"total_respuestas"`  // total anual (ej. 336 = 7*48)
	KItems          int64 `json:"k_items"`           // #ítems por dimensión (ej. 16)

	// ✅ estadística por ítems
	Promedio float64 `json:"promedio"`
	StdDev   float64 `json:"std_dev"` // σ (ítems)

	Mediana float64 `json:"mediana"`
	P25     float64 `json:"p25"`
	P75     float64 `json:"p75"`

	// ✅ IC95 por ítems (n = n_respuestas)
	IC95Inferior float64 `json:"ic95_inferior"`
	IC95Superior float64 `json:"ic95_superior"`

	// ✅ estadística entre encuestas (más conservador)
	StdDevEncuestas      float64 `json:"std_dev_encuestas"`
	IC95InferiorEncuestas float64 `json:"ic95_inferior_encuestas"`
	IC95SuperiorEncuestas float64 `json:"ic95_superior_encuestas"`

	AlphaCronbach float64 `json:"alpha_cronbach"`
}

type CentroEstadisticaAvanzadaResponse struct {
	Centros []int64                `json:"centros"`
	Year    int                    `json:"year"`
	Datos   []EstadisticaDimension `json:"datos"`
}

func (h CentroResultadosHandler) GetCentroEstadisticaAvanzada(w http.ResponseWriter, r *http.Request) {
	if !h.ensureCentroRole(w, r) {
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	ys := r.URL.Query().Get("year")
	if ys == "" {
		http.Error(w, "year_required", http.StatusBadRequest)
		return
	}

	year, err := strconv.Atoi(ys)
	if err != nil {
		http.Error(w, "bad_year", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	rows, err := h.DB.Query(ctx, `
		with base as (
			select
				r.dimension::text as dimension,
				r.pregunta_id::text as pregunta_id,
				r.valor::float8 as valor,
				e.id as encuesta_id
			from respuestas r
			join encuestas e on e.id = r.encuesta_id
			where e.centro_id = any($1::bigint[])
			  and e.finished_at is not null
			  and extract(year from e.finished_at)::int = $2
		),

		-- ✅ total real de respuestas del año (todas las dimensiones)
		total_respuestas as (
			select count(*)::bigint as total_respuestas
			from base
		),

		-- ==========================
		-- Stats por ÍTEMS (como antes)
		-- ==========================
		stats_items as (
			select
				dimension,
				count(*)::bigint as n_respuestas,
				count(distinct encuesta_id)::bigint as n_encuestas,
				avg(valor)::float8 as promedio,
				stddev_samp(valor)::float8 as stddev,
				percentile_cont(0.5) within group (order by valor) as mediana,
				percentile_cont(0.25) within group (order by valor) as p25,
				percentile_cont(0.75) within group (order by valor) as p75
			from base
			group by dimension
		),

		-- ==========================
		-- Stats ENTRE ENCUESTAS
		-- 1 fila por (dimension, encuesta_id) con el promedio de la dimensión
		-- ==========================
		encuesta_dim as (
			select
				dimension,
				encuesta_id,
				avg(valor)::float8 as promedio_encuesta
			from base
			group by dimension, encuesta_id
		),
		stats_encuestas as (
			select
				dimension,
				count(*)::bigint as n_encuestas, -- aquí count(*) == count(distinct encuesta_id)
				avg(promedio_encuesta)::float8 as promedio_encuestas,
				stddev_samp(promedio_encuesta)::float8 as stddev_encuestas
			from encuesta_dim
			group by dimension
		),

		-- ==========================
		-- Cronbach alpha por dimensión
		-- ==========================
		item_values as (
			select
				dimension,
				encuesta_id,
				pregunta_id,
				avg(valor)::float8 as v
			from base
			group by dimension, encuesta_id, pregunta_id
		),
		item_vars as (
			select
				dimension,
				pregunta_id,
				var_samp(v)::float8 as var_item
			from item_values
			group by dimension, pregunta_id
		),
		k_items as (
			select
				dimension,
				count(*)::bigint as k,
				coalesce(sum(var_item), 0)::float8 as sum_var_items
			from item_vars
			group by dimension
		),
		total_scores as (
			select
				dimension,
				encuesta_id,
				sum(v)::float8 as total_score
			from item_values
			group by dimension, encuesta_id
		),
		total_var as (
			select
				dimension,
				var_samp(total_score)::float8 as var_total
			from total_scores
			group by dimension
		),
		alpha as (
			select
				k.dimension,
				k.k,
				case
					when k.k is null or k.k < 2 then 0::float8
					when tv.var_total is null or tv.var_total <= 0 then 0::float8
					else (k.k::float8 / (k.k::float8 - 1.0)) * (1.0 - (k.sum_var_items / tv.var_total))
				end as alpha
			from k_items k
			left join total_var tv on tv.dimension = k.dimension
		)

		select
			si.dimension,
			si.n_respuestas,
			si.n_encuestas,
			tr.total_respuestas,
			coalesce(a.k, 0)::bigint as k_items,

			si.promedio,
			coalesce(si.stddev, 0)::float8 as stddev,
			si.mediana,
			si.p25,
			si.p75,

			-- IC95 por ítems (n = n_respuestas)
			case
				when si.n_respuestas < 2 or coalesce(si.stddev,0) = 0 then si.promedio
				else (si.promedio - 1.96 * (coalesce(si.stddev,0) / sqrt(si.n_respuestas::float8)))
			end as ic_inf_items,
			case
				when si.n_respuestas < 2 or coalesce(si.stddev,0) = 0 then si.promedio
				else (si.promedio + 1.96 * (coalesce(si.stddev,0) / sqrt(si.n_respuestas::float8)))
			end as ic_sup_items,

			-- σ e IC95 conservador entre encuestas (n = n_encuestas)
			coalesce(se.stddev_encuestas, 0)::float8 as stddev_encuestas,
			case
				when coalesce(se.n_encuestas,0) < 2 or coalesce(se.stddev_encuestas,0) = 0 then si.promedio
				else (si.promedio - 1.96 * (coalesce(se.stddev_encuestas,0) / sqrt(se.n_encuestas::float8)))
			end as ic_inf_enc,
			case
				when coalesce(se.n_encuestas,0) < 2 or coalesce(se.stddev_encuestas,0) = 0 then si.promedio
				else (si.promedio + 1.96 * (coalesce(se.stddev_encuestas,0) / sqrt(se.n_encuestas::float8)))
			end as ic_sup_enc,

			coalesce(a.alpha, 0)::float8 as alpha
		from stats_items si
		cross join total_respuestas tr
		left join stats_encuestas se on se.dimension = si.dimension
		left join alpha a on a.dimension = si.dimension
		order by si.dimension
	`, centros, year)

	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]EstadisticaDimension, 0, 4)

	for rows.Next() {
		var d EstadisticaDimension
		if err := rows.Scan(
			&d.Dimension,
			&d.NRespuestas,
			&d.NEncuestas,
			&d.TotalRespuestas,
			&d.KItems,

			&d.Promedio,
			&d.StdDev,
			&d.Mediana,
			&d.P25,
			&d.P75,

			&d.IC95Inferior,
			&d.IC95Superior,

			&d.StdDevEncuestas,
			&d.IC95InferiorEncuestas,
			&d.IC95SuperiorEncuestas,

			&d.AlphaCronbach,
		); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		out = append(out, d)
	}

	if len(out) == 0 {
		http.Error(w, "no_data", http.StatusNotFound)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroEstadisticaAvanzadaResponse{
		Centros: centros,
		Year:    year,
		Datos:   out,
	})
}
