package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RespuestasHandler struct {
	DB *pgxpool.Pool
}

type RespuestaItem struct {
	PreguntaID string `json:"pregunta_id"`
	Dimension  string `json:"dimension"`
	Valor      int16  `json:"valor"`
}

type SaveRespuestasRequest struct {
	EncuestaID string          `json:"encuesta_id"`
	Respuestas []RespuestaItem `json:"respuestas"`

	// NUEVO: comentario final opcional (1 por encuesta)
	Comentario *string `json:"comentario,omitempty"`
}

type SaveRespuestasResponse struct {
	Ok       bool `json:"ok"`
	Inserted int  `json:"inserted"`
}

var rePregunta = regexp.MustCompile(`^P([1-9]|1[0-6])$`)

func (h RespuestasHandler) Save(w http.ResponseWriter, r *http.Request) {
	var req SaveRespuestasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	req.EncuestaID = strings.TrimSpace(req.EncuestaID)
	if req.EncuestaID == "" {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}

	if len(req.Respuestas) != 48 {
		http.Error(w, "need_48_answers", http.StatusBadRequest)
		return
	}

	// NUEVO: normalizar comentario (opcional)
	var comentario *string = nil
	if req.Comentario != nil {
		c := strings.TrimSpace(*req.Comentario)
		if c == "" {
			comentario = nil
		} else {
			// límite defensivo para evitar payloads enormes
			// (si también pusiste CHECK en BD, mejor)
			if len([]rune(c)) > 2000 {
				http.Error(w, "bad_comentario", http.StatusBadRequest)
				return
			}
			comentario = &c
		}
	}

	ctx := r.Context()

	var exists bool
	if err := h.DB.QueryRow(ctx, `select exists(select 1 from encuestas where id = $1)`, req.EncuestaID).Scan(&exists); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, "encuesta_not_found", http.StatusNotFound)
		return
	}

	seen := make(map[string]struct{}, 64)

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	batch := &pgx.Batch{}
	inserted := 0

	for _, it := range req.Respuestas {
		pid := strings.TrimSpace(it.PreguntaID)
		dim := strings.TrimSpace(strings.ToLower(it.Dimension))

		if !rePregunta.MatchString(pid) {
			http.Error(w, "bad_pregunta_id", http.StatusBadRequest)
			return
		}
		if dim != "frecuencia" && dim != "normalidad" && dim != "gravedad" {
			http.Error(w, "bad_dimension", http.StatusBadRequest)
			return
		}
		if it.Valor < 1 || it.Valor > 5 {
			http.Error(w, "bad_valor", http.StatusBadRequest)
			return
		}

		key := pid + "|" + dim
		if _, ok := seen[key]; ok {
			http.Error(w, "duplicate_answer", http.StatusBadRequest)
			return
		}
		seen[key] = struct{}{}

		batch.Queue(`
			insert into respuestas (encuesta_id, pregunta_id, dimension, valor)
			values ($1, $2, $3, $4)
			on conflict (encuesta_id, pregunta_id, dimension)
			do update set valor = excluded.valor
		`, req.EncuestaID, pid, dim, it.Valor)

		inserted++
	}

	// Ejecutar batch de respuestas
	br := tx.SendBatch(ctx, batch)
	if err := br.Close(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// NUEVO: guardar comentario opcional (1 por encuesta) + marcar finished_at
	// - Si comentario == nil, lo dejamos como NULL (no forzamos a borrar nada existente).
	// - finished_at siempre se marca al guardar respuestas (si prefieres otra lógica, lo ajustamos).
	if _, err := tx.Exec(ctx, `
		update encuestas
		set
			comentario = coalesce($2, comentario),
			finished_at = now()
		where id = $1
	`, req.EncuestaID, comentario); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(SaveRespuestasResponse{Ok: true, Inserted: inserted})
}
