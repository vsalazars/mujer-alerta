package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type healthTestPinger struct {
	err error
}

func (p healthTestPinger) Ping(context.Context) error {
	return p.err
}

func TestHealthHandlerHealth(t *testing.T) {
	handler := HealthHandler{}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	handler.Health(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d; esperado %d", res.Code, http.StatusOK)
	}

	if res.Body.String() != "ok" {
		t.Fatalf("body = %q; esperado %q", res.Body.String(), "ok")
	}
}

func TestHealthHandlerRejectsUnsupportedMethod(t *testing.T) {
	handler := HealthHandler{}

	req := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	res := httptest.NewRecorder()

	handler.Health(res, req)

	if res.Code != http.StatusMethodNotAllowed {
		t.Fatalf(
			"status = %d; esperado %d",
			res.Code,
			http.StatusMethodNotAllowed,
		)
	}
}

func TestHealthHandlerReady(t *testing.T) {
	handler := HealthHandler{
		DB:           healthTestPinger{},
		ReadyTimeout: time.Second,
	}

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	handler.Ready(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d; esperado %d", res.Code, http.StatusOK)
	}

	if res.Body.String() != "ready" {
		t.Fatalf("body = %q; esperado %q", res.Body.String(), "ready")
	}
}

func TestHealthHandlerReadyWhenDatabaseFails(t *testing.T) {
	handler := HealthHandler{
		DB:           healthTestPinger{err: errors.New("database unavailable")},
		ReadyTimeout: time.Second,
	}

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()

	handler.Ready(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf(
			"status = %d; esperado %d",
			res.Code,
			http.StatusServiceUnavailable,
		)
	}
}
