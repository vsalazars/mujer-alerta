package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type EncuestasHandler struct {
	DB *pgxpool.Pool
}

type CreateEncuestaRequest struct {
	CentroID int64  `json:"centro_id"`
	Email    string `json:"email,omitempty"`
	GeneroID int64  `json:"genero_id"`
	Edad     int16  `json:"edad"`
}

type CreateEncuestaResponse struct {
	EncuestaID string `json:"encuesta_id"`
}

func (h EncuestasHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateEncuestaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	if req.CentroID <= 0 || req.GeneroID <= 0 || req.Edad < 10 || req.Edad > 120 {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(req.Email)
	if email == "" {
		email = ""
	}

	var id string
	err := h.DB.QueryRow(r.Context(), `
		insert into encuestas (centro_id, email, genero_id, edad)
		values ($1, nullif($2,''), $3, $4)
		returning id::text
	`, req.CentroID, email, req.GeneroID, req.Edad).Scan(&id)

	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(CreateEncuestaResponse{EncuestaID: id})
}
