package handlers

import (
	"encoding/json"
	"net/http"
)

type InstrumentoHandler struct {
	Data any
}

func (h InstrumentoHandler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(h.Data)
}
