package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func writeJSONCentro(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func decodeStringArrayJSON(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}

	var arr []any
	if err := json.Unmarshal(raw, &arr); err != nil {
		return []string{}
	}

	out := make([]string, 0, len(arr))
	for _, item := range arr {
		switch v := item.(type) {
		case string:
			if s := strings.TrimSpace(v); s != "" {
				out = append(out, s)
			}
		case map[string]any:
			for _, key := range []string{"label", "keyword", "text", "name"} {
				if rawValue, ok := v[key].(string); ok {
					if s := strings.TrimSpace(rawValue); s != "" {
						out = append(out, s)
						break
					}
				}
			}
		}
	}
	return out
}

func (h CentroResultadosHandler) ensureCentroRole(w http.ResponseWriter, r *http.Request) bool {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	return true
}

func (h CentroResultadosHandler) requireCentros(w http.ResponseWriter, r *http.Request) ([]int64, bool) {
	if !h.ensureCentroRole(w, r) {
		return nil, false
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return nil, false
	}

	return centros, true
}

func parseOptionalYear(raw string) (*int, error) {
	if raw == "" {
		return nil, nil
	}

	year, err := strconv.Atoi(raw)
	if err != nil {
		return nil, err
	}
	return &year, nil
}

func parseRequiredYear(raw string) (int, error) {
	return strconv.Atoi(raw)
}

func parseYearsCSV(raw string) ([]int, error) {
	if raw == "" {
		return nil, nil
	}

	parts := strings.Split(raw, ",")
	years := make([]int, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		year, err := strconv.Atoi(part)
		if err != nil {
			return nil, err
		}
		years = append(years, year)
	}

	return years, nil
}

func (h CentroResultadosHandler) queryCentroYears(centros []int64, order string) ([]int, error) {
	rows, err := query(
		context.Background(),
		h.DB,
		`
		select distinct extract(year from e.finished_at)::int as year
		from encuestas e
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		order by year `+order,
		centros,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	years := make([]int, 0, 8)
	for rows.Next() {
		var year int
		if err := rows.Scan(&year); err != nil {
			return nil, err
		}
		years = append(years, year)
	}

	return years, rows.Err()
}

func newCentroStats(totalParticipantes, totalRespuestas int64) CentroStats {
	return CentroStats{
		TotalParticipantes:  totalParticipantes,
		TotalEncuestas:      totalParticipantes,
		TotalRespuestas:     totalRespuestas,
		EncuestasPorGenero:  []CountItem{},
		RespuestasPorGenero: []CountItem{},
		EncuestasPorEdad:    []CountItem{},
		RespuestasPorEdad:   []CountItem{},
		ResumenPorGenero:    []GeneroDimItem{},
		Comentarios:         []ComentarioItem{},
		NLP: NLPStats{
			PorSentimiento: []CountItem{},
			PorEmocion:     []CountItem{},
			PorTema:        []CountItem{},
		},
	}
}
