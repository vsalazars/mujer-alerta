package handlers

import "net/http"

func (h CentroResultadosHandler) GetResumenCentroAnual(w http.ResponseWriter, r *http.Request) {
	centros, ok := h.requireCentros(w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	years, err := parseYearsCSV(r.URL.Query().Get("years"))
	if err != nil {
		http.Error(w, "bad_years", http.StatusBadRequest)
		return
	}
	if r.URL.Query().Get("years") != "" && len(years) == 0 {
		http.Error(w, "bad_years", http.StatusBadRequest)
		return
	}

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
			var year int
			if err := rows.Scan(&year); err != nil {
				rows.Close()
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			years = append(years, year)
		}
		rows.Close()
	}

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
		var point CentroAnualPoint
		if err := rows.Scan(
			&point.Year,
			&point.Frecuencia,
			&point.Normalidad,
			&point.Gravedad,
			&point.Total,
			&point.Encuestas,
			&point.Respuestas,
		); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		series = append(series, point)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if len(series) == 0 {
		http.Error(w, "no_data", http.StatusNotFound)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroResumenAnualResponse{
		Centros: centros,
		Series:  series,
	})
}
