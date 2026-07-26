package handlers

import (
	"context"
	"net/http"
	"time"
)

type DatabasePinger interface {
	Ping(context.Context) error
}

type HealthHandler struct {
	DB           DatabasePinger
	ReadyTimeout time.Duration
}

func (h HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte("ok"))
	}
}

func (h HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.DB == nil {
		http.Error(w, "database_not_configured", http.StatusServiceUnavailable)
		return
	}

	timeout := h.ReadyTimeout
	if timeout <= 0 {
		timeout = 2 * time.Second
	}

	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	if err := h.DB.Ping(ctx); err != nil {
		http.Error(w, "database_unavailable", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte("ready"))
	}
}
