package config

import (
	"reflect"
	"testing"
	"time"
)

func TestLoadUsesServerlessDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("PORT", "")
	t.Setenv("ADDR", "")
	t.Setenv("DB_MAX_CONNS", "")
	t.Setenv("DB_MIN_CONNS", "")
	t.Setenv("DB_MAX_CONN_IDLE_TIME", "")
	t.Setenv("DB_MAX_CONN_LIFETIME", "")
	t.Setenv("DB_HEALTH_CHECK_PERIOD", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Address != ":8080" {
		t.Fatalf("Address = %q; esperado :8080", cfg.Address)
	}
	if cfg.DBMaxConns != 3 {
		t.Fatalf("DBMaxConns = %d; esperado 3", cfg.DBMaxConns)
	}
	if cfg.DBMinConns != 0 {
		t.Fatalf("DBMinConns = %d; esperado 0", cfg.DBMinConns)
	}
	if cfg.DBMaxConnIdleTime != 5*time.Minute {
		t.Fatalf(
			"DBMaxConnIdleTime = %s; esperado 5m",
			cfg.DBMaxConnIdleTime,
		)
	}
}

func TestLoadPrefersCloudRunPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("PORT", "9090")
	t.Setenv("ADDR", "127.0.0.1:9999")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Address != ":9090" {
		t.Fatalf("Address = %q; esperado :9090", cfg.Address)
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("PORT", "invalid")

	if _, err := Load(); err == nil {
		t.Fatal("Load() no devolvió error para PORT inválido")
	}
}

func TestLoadRejectsMinConnsGreaterThanMaxConns(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("DB_MAX_CONNS", "2")
	t.Setenv("DB_MIN_CONNS", "3")

	if _, err := Load(); err == nil {
		t.Fatal("Load() no devolvió error para límites incompatibles")
	}
}

func TestLoadParsesCORSOrigins(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv(
		"CORS_ALLOWED_ORIGINS",
		"https://uno.example, https://dos.example,https://uno.example",
	)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	expected := []string{
		"https://uno.example",
		"https://dos.example",
	}

	if !reflect.DeepEqual(cfg.CORSAllowedOrigins, expected) {
		t.Fatalf(
			"CORSAllowedOrigins = %#v; esperado %#v",
			cfg.CORSAllowedOrigins,
			expected,
		)
	}
}
