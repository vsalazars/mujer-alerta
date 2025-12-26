package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"mujer-back/db"
	"mujer-back/handlers"
	"mujer-back/services"
)

func main() {
	_ = godotenv.Load()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Println("Falta DATABASE_URL")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, dsn)
	if err != nil {
		fmt.Println("DB error:", err)
		os.Exit(1)
	}
	defer pool.Close()

	instrumento, err := services.LoadInstrumento("config/instrumento_mujer_alerta.json")
	if err != nil {
		fmt.Println("Instrumento error:", err)
		os.Exit(1)
	}

	fmt.Println("Instrumento cargado:", instrumento.Name, instrumento.Version)

	mux := http.NewServeMux()

	// ======================
	// Health
	// ======================
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// ======================
	// Instrumento
	// ======================
	ih := handlers.InstrumentoHandler{Data: instrumento}
	mux.HandleFunc("/api/instrumento", ih.Get)

	// ======================
	// Encuestas
	// ======================
	eh := handlers.EncuestasHandler{DB: pool}
	mux.HandleFunc("/api/encuestas", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			eh.Create(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Respuestas
	// ======================
	rh := handlers.RespuestasHandler{DB: pool}
	mux.HandleFunc("/api/respuestas", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			rh.Save(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Resumen por encuesta
	// ======================
	rhResumen := handlers.ResumenHandler{DB: pool}
	mux.HandleFunc("/api/encuestas/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			rhResumen.GetByPath(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Centros (CRUD)
	// ======================
	ch := handlers.CentrosHandler{DB: pool}

	// /api/centros → GET (público), POST (admin)
	mux.HandleFunc("/api/centros", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {

		case http.MethodGet:
			ch.List(w, r)
			return

		case http.MethodPost:
			handlers.RequireJWT(
				handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					ch.Create(w, r)
				})),
			).ServeHTTP(w, r)
			return

		default:
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
			return
		}
	})

	// /api/centros/{id} → GET / PUT / DELETE (admin)
	mux.HandleFunc("/api/centros/", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

				idStr := strings.TrimPrefix(r.URL.Path, "/api/centros/")
				idStr = strings.Trim(idStr, "/")
				if idStr == "" {
					http.NotFound(w, r)
					return
				}

				id, err := strconv.ParseInt(idStr, 10, 64)
				if err != nil || id <= 0 {
					http.Error(w, "bad_id", http.StatusBadRequest)
					return
				}

				switch r.Method {
				case http.MethodGet:
					ch.GetByID(w, r, id)
					return
				case http.MethodPut:
					ch.Update(w, r, id)
					return
				case http.MethodDelete:
					ch.Delete(w, r, id)
					return
				default:
					http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
					return
				}
			})),
		).ServeHTTP(w, r)
	})

	// ======================
	// Géneros
	// ======================
	gh := handlers.GenerosHandler{DB: pool}
	mux.HandleFunc("/api/generos", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			gh.List(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Auth
	// ======================
	ah := handlers.AuthHandler{DB: pool}
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			ah.Login(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Admin: Usuarios (CRUD)
	// ======================
	auh := handlers.AdminUsuariosHandler{DB: pool}

	// /api/admin/usuarios → GET, POST (admin)
	mux.HandleFunc("/api/admin/usuarios", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

				switch r.Method {
				case http.MethodGet:
					auh.List(w, r)
					return
				case http.MethodPost:
					auh.Create(w, r)
					return
				default:
					http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
					return
				}

			})),
		).ServeHTTP(w, r)
	})

	// /api/admin/usuarios/{uuid} → PUT / DELETE (admin)
	mux.HandleFunc("/api/admin/usuarios/", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

				id := strings.TrimPrefix(r.URL.Path, "/api/admin/usuarios/")
				id = strings.Trim(id, "/")
				if id == "" {
					http.NotFound(w, r)
					return
				}

				switch r.Method {
				case http.MethodPut:
					auh.Update(w, r, id)
					return
				case http.MethodDelete:
					auh.Disable(w, r, id)
					return
				default:
					http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
					return
				}

			})),
		).ServeHTTP(w, r)
	})


	// ======================
	// Centro: Resumen agregado (ÚNICO endpoint válido)
	// ======================
	crh := handlers.CentroResultadosHandler{DB: pool}
	mux.HandleFunc("/api/centro/resumen", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetResumenCentro(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Años disponibles (solo años con datos)
	// ======================
	mux.HandleFunc("/api/centro/years", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetCentroYears(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})


	// ======================
	// CORS
	// ======================
	handler := handlers.CORS(mux, handlers.CORSOptions{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		},
		AllowedMethods: "GET, POST, PUT, DELETE, OPTIONS",
		AllowedHeaders: "Content-Type, Authorization",
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	fmt.Println("Listening on", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		fmt.Println("HTTP error:", err)
		os.Exit(1)
	}
}
