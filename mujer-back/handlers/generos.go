package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type GenerosHandler struct {
	DB *pgxpool.Pool
}

type GeneroDTO struct {
	ID          int64   `json:"id"`
	Clave       string  `json:"clave"`
	Etiqueta    string  `json:"etiqueta"`
	Descripcion *string `json:"descripcion,omitempty"`
}

func (h GenerosHandler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		select id, clave, etiqueta, descripcion
		from generos
		where activo = true
		order by id asc
	`)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]GeneroDTO, 0, 16)
	for rows.Next() {
		var g GeneroDTO
		if err := rows.Scan(&g.ID, &g.Clave, &g.Etiqueta, &g.Descripcion); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		out = append(out, g)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}
