package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"mujer-back/services"
)

type RespuestasInicialesHandler struct {
	DB            *pgxpool.Pool
	PreguntasMeta services.PreguntasInicialesMeta
}

type RespuestaInicialItem struct {
	PreguntaID string `json:"pregunta_id"`
	OpcionID   string `json:"opcion_id"`
}

type SaveRespuestasInicialesRequest struct {
	EncuestaID string                 `json:"encuesta_id"`
	Respuestas []RespuestaInicialItem `json:"respuestas"`
}

type SaveRespuestasInicialesResponse struct {
	Ok       bool `json:"ok"`
	Inserted int  `json:"inserted"`
}

func (h RespuestasInicialesHandler) Save(w http.ResponseWriter, r *http.Request) {
	var req SaveRespuestasInicialesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	req.EncuestaID = strings.TrimSpace(req.EncuestaID)
	if req.EncuestaID == "" {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}

	if len(req.Respuestas) != h.PreguntasMeta.TotalQuestions {
		http.Error(w, "need_all_initial_answers", http.StatusBadRequest)
		return
	}

	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok || institucionID <= 0 {
		http.Error(w, "institucion_not_found", http.StatusBadRequest)
		return
	}

	var exists bool
	if err := queryRow(
		r.Context(),
		h.DB,
		`select exists(select 1 from encuestas where id = $1 and institucion_id = $2)`,
		req.EncuestaID,
		institucionID,
	).Scan(&exists); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, "encuesta_not_found", http.StatusNotFound)
		return
	}

	seen := make(map[string]struct{}, h.PreguntasMeta.TotalQuestions)
	tx, err := begin(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	batch := &pgx.Batch{}
	inserted := 0

	for _, it := range req.Respuestas {
		questionID := strings.TrimSpace(it.PreguntaID)
		optionID := strings.TrimSpace(it.OpcionID)

		allowedOptions, ok := h.PreguntasMeta.AllowedOptionsByQuestion[questionID]
		if !ok {
			http.Error(w, "bad_pregunta_id", http.StatusBadRequest)
			return
		}
		if _, ok := allowedOptions[optionID]; !ok {
			http.Error(w, "bad_opcion_id", http.StatusBadRequest)
			return
		}
		if _, duplicated := seen[questionID]; duplicated {
			http.Error(w, "duplicate_answer", http.StatusBadRequest)
			return
		}
		seen[questionID] = struct{}{}

		batch.Queue(`
			insert into respuestas_iniciales (encuesta_id, institucion_id, pregunta_id, opcion_id)
			values ($1, $2, $3, $4)
			on conflict (encuesta_id, pregunta_id)
			do update set
				opcion_id = excluded.opcion_id,
				updated_at = now()
		`, req.EncuestaID, institucionID, questionID, optionID)
		inserted++
	}

	if err := tx.SendBatch(r.Context(), batch).Close(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(SaveRespuestasInicialesResponse{Ok: true, Inserted: inserted})
}
