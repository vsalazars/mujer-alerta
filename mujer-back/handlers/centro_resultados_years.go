package handlers

import "net/http"

func (h CentroResultadosHandler) GetCentroYears(w http.ResponseWriter, r *http.Request) {
	centros, ok := h.requireCentros(w, r)
	if !ok {
		return
	}

	rows, err := query(r.Context(), h.DB, `
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
		var year int
		if err := rows.Scan(&year); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		years = append(years, year)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroYearsResponse{Years: years})
}
