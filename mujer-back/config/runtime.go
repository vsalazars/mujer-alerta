package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	defaultAddress                   = ":8080"
	defaultDBMaxConns          int32 = 3
	defaultDBMinConns          int32 = 0
	defaultDBMaxConnIdleTime         = 5 * time.Minute
	defaultDBMaxConnLifetime         = 30 * time.Minute
	defaultDBHealthCheckPeriod       = 30 * time.Second
)

var defaultCORSAllowedOrigins = []string{
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"https://mujer-alerta.vercel.app",
	"https://mujer-alerta-git-main-vidal-salazars-projects.vercel.app",
	"https://mujer-alerta-92958pdcf-vidal-salazars-projects.vercel.app",
}

type Runtime struct {
	DatabaseURL string
	Address     string

	CORSAllowedOrigins []string

	DBMaxConns          int32
	DBMinConns          int32
	DBMaxConnIdleTime   time.Duration
	DBMaxConnLifetime   time.Duration
	DBHealthCheckPeriod time.Duration
}

func Load() (Runtime, error) {
	// En desarrollo permite usar .env.
	// En Cloud Run el archivo no existirá y se usarán variables de entorno.
	_ = godotenv.Load()

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		return Runtime{}, fmt.Errorf("DATABASE_URL es obligatoria")
	}

	address, err := resolveAddress(
		strings.TrimSpace(os.Getenv("PORT")),
		strings.TrimSpace(os.Getenv("ADDR")),
	)
	if err != nil {
		return Runtime{}, err
	}

	maxConns, err := int32Env("DB_MAX_CONNS", defaultDBMaxConns, 1, 100)
	if err != nil {
		return Runtime{}, err
	}

	minConns, err := int32Env("DB_MIN_CONNS", defaultDBMinConns, 0, 100)
	if err != nil {
		return Runtime{}, err
	}

	if minConns > maxConns {
		return Runtime{}, fmt.Errorf(
			"DB_MIN_CONNS (%d) no puede ser mayor que DB_MAX_CONNS (%d)",
			minConns,
			maxConns,
		)
	}

	maxIdle, err := durationEnv(
		"DB_MAX_CONN_IDLE_TIME",
		defaultDBMaxConnIdleTime,
	)
	if err != nil {
		return Runtime{}, err
	}

	maxLifetime, err := durationEnv(
		"DB_MAX_CONN_LIFETIME",
		defaultDBMaxConnLifetime,
	)
	if err != nil {
		return Runtime{}, err
	}

	healthPeriod, err := durationEnv(
		"DB_HEALTH_CHECK_PERIOD",
		defaultDBHealthCheckPeriod,
	)
	if err != nil {
		return Runtime{}, err
	}

	origins := csvEnv("CORS_ALLOWED_ORIGINS")
	if len(origins) == 0 {
		origins = append([]string(nil), defaultCORSAllowedOrigins...)
	}

	return Runtime{
		DatabaseURL: databaseURL,
		Address:     address,

		CORSAllowedOrigins: origins,

		DBMaxConns:          maxConns,
		DBMinConns:          minConns,
		DBMaxConnIdleTime:   maxIdle,
		DBMaxConnLifetime:   maxLifetime,
		DBHealthCheckPeriod: healthPeriod,
	}, nil
}

func resolveAddress(port, address string) (string, error) {
	if port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return "", fmt.Errorf("PORT inválido: %q", port)
		}
		return ":" + strconv.Itoa(value), nil
	}

	if address != "" {
		return address, nil
	}

	return defaultAddress, nil
}

func int32Env(name string, fallback, minimum, maximum int32) (int32, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}

	value64, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%s debe ser un entero válido", name)
	}

	value := int32(value64)
	if value < minimum || value > maximum {
		return 0, fmt.Errorf(
			"%s debe estar entre %d y %d",
			name,
			minimum,
			maximum,
		)
	}

	return value, nil
}

func durationEnv(name string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}

	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf(
			"%s debe ser una duración válida, por ejemplo 30s o 5m",
			name,
		)
	}

	if value <= 0 {
		return 0, fmt.Errorf("%s debe ser mayor que cero", name)
	}

	return value, nil
}

func csvEnv(name string) []string {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return nil
	}

	values := make([]string, 0)
	seen := make(map[string]struct{})

	for _, item := range strings.Split(raw, ",") {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}

		seen[value] = struct{}{}
		values = append(values, value)
	}

	return values
}
