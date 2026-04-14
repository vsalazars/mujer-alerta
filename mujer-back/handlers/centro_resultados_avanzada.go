package handlers

import "net/http"

func (h CentroResultadosHandler) GetCentroEstadisticaAvanzada(w http.ResponseWriter, r *http.Request) {
	centros, ok := h.requireCentros(w, r)
	if !ok {
		return
	}

	rawYear := r.URL.Query().Get("year")
	if rawYear == "" {
		http.Error(w, "year_required", http.StatusBadRequest)
		return
	}

	year, err := parseRequiredYear(rawYear)
	if err != nil {
		http.Error(w, "bad_year", http.StatusBadRequest)
		return
	}

	rows, err := query(r.Context(), h.DB, `
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
		total_respuestas as (
			select count(*)::bigint as total_respuestas
			from base
		),
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
				count(*)::bigint as n_encuestas,
				avg(promedio_encuesta)::float8 as promedio_encuestas,
				stddev_samp(promedio_encuesta)::float8 as stddev_encuestas
			from encuesta_dim
			group by dimension
		),
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
			case
				when si.n_respuestas < 2 or coalesce(si.stddev,0) = 0 then si.promedio
				else (si.promedio - 1.96 * (coalesce(si.stddev,0) / sqrt(si.n_respuestas::float8)))
			end as ic_inf_items,
			case
				when si.n_respuestas < 2 or coalesce(si.stddev,0) = 0 then si.promedio
				else (si.promedio + 1.96 * (coalesce(si.stddev,0) / sqrt(si.n_respuestas::float8)))
			end as ic_sup_items,
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
		var item EstadisticaDimension
		if err := rows.Scan(
			&item.Dimension,
			&item.NRespuestas,
			&item.NEncuestas,
			&item.TotalRespuestas,
			&item.KItems,
			&item.Promedio,
			&item.StdDev,
			&item.Mediana,
			&item.P25,
			&item.P75,
			&item.IC95Inferior,
			&item.IC95Superior,
			&item.StdDevEncuestas,
			&item.IC95InferiorEncuestas,
			&item.IC95SuperiorEncuestas,
			&item.AlphaCronbach,
		); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		out = append(out, item)
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
