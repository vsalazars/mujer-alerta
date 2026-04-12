package handlers

import (
	"encoding/json"
	"net/http"

	"mujer-back/services"
)

type CentroNLPHandler struct {
	Runner services.NLPRunner
}

type CentroNLPProcessRequest struct {
	Limit      *int   `json:"limit"`
	EncuestaID string `json:"encuesta_id"`
	Year       *int   `json:"year"`
	DryRun     bool   `json:"dry_run"`
}

type CentroNLPProcessResponse struct {
	Centros []int64               `json:"centros"`
	Result  services.NLPRunResult `json:"result"`
}

func (h CentroNLPHandler) Process(w http.ResponseWriter, r *http.Request) {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	var req CentroNLPProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	result, err := h.Runner.RunAnalyzeComments(r.Context(), services.NLPRunOptions{
		Limit:      req.Limit,
		EncuestaID: req.EncuestaID,
		CentroIDs:  centros,
		Year:       req.Year,
		DryRun:     req.DryRun,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":   "nlp_process_failed",
			"detail":  err.Error(),
			"centros": centros,
			"result":  result,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(CentroNLPProcessResponse{
		Centros: centros,
		Result:  result,
	})
}
