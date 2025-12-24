package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ResumenHandler struct {
	DB *pgxpool.Pool
}

type ResumenGlobal struct {
	Frecuencia float64 `json:"frecuencia"`
	Normalidad float64 `json:"normalidad"`
	Gravedad   float64 `json:"gravedad"`
	Total      float64 `json:"total"`
}

type MatrizItem struct {
	TipoNum    int32   `json:"tipo_num"`
	TipoNombre string  `json:"tipo_nombre"`
	Dimension  string  `json:"dimension"`
	Promedio   float64 `json:"promedio"`
}

type EncuestaResumenResponse struct {
	EncuestaID string        `json:"encuesta_id"`
	Global     ResumenGlobal `json:"global"`
	Matriz     []MatrizItem  `json:"matriz"`
}

func (h ResumenHandler) GetByPath(w http.ResponseWriter, r *http.Request) {
	// Espera: /api/encuestas/{id}/resumen
	path := strings.TrimPrefix(r.URL.Path, "/api/encuestas/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 || parts[1] != "resumen" || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	encuestaID := parts[0]

	var exists bool
	if err := h.DB.QueryRow(r.Context(), `select exists(select 1 from encuestas where id = $1)`, encuestaID).Scan(&exists); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, "encuesta_not_found", http.StatusNotFound)
		return
	}

	var g ResumenGlobal

	rows, err := h.DB.Query(r.Context(), `
		select dimension::text, avg(valor)::float8
		from respuestas
		where encuesta_id = $1
		group by dimension
	`, encuestaID)
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
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if err := h.DB.QueryRow(r.Context(), `
		select avg(valor)::float8
		from respuestas
		where encuesta_id = $1
	`, encuestaID).Scan(&g.Total); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	mrows, err := h.DB.Query(r.Context(), `
		select tipo_num, tipo_nombre, dimension::text, promedio::float8
		from v_matriz_tipo_dimension
		where encuesta_id = $1
		order by tipo_num, dimension
	`, encuestaID)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer mrows.Close()

	matriz := make([]MatrizItem, 0, 24)
	for mrows.Next() {
		var it MatrizItem
		if err := mrows.Scan(&it.TipoNum, &it.TipoNombre, &it.Dimension, &it.Promedio); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		matriz = append(matriz, it)
	}
	if mrows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(EncuestaResumenResponse{
		EncuestaID: encuestaID,
		Global:     g,
		Matriz:     matriz,
	})
}
