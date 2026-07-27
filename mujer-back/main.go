package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"mujer-back/config"
	"mujer-back/db"
	"mujer-back/handlers"
	"mujer-back/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("Config error:", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL, db.PoolOptions{
		MaxConns:          cfg.DBMaxConns,
		MinConns:          cfg.DBMinConns,
		MaxConnIdleTime:   cfg.DBMaxConnIdleTime,
		MaxConnLifetime:   cfg.DBMaxConnLifetime,
		HealthCheckPeriod: cfg.DBHealthCheckPeriod,
	})
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}
	defer pool.Close()

	instrumento, err := services.LoadInstrumento("config/instrumento_mujer_alerta.json")
	if err != nil {
		fmt.Println("Instrumento error:", err)
		os.Exit(1)
	}

	preguntasIniciales, err := services.LoadPreguntasIniciales("config/preguntas_iniciales_mujer_alerta.json")
	if err != nil {
		fmt.Println("Preguntas iniciales error:", err)
		os.Exit(1)
	}

	preguntasInicialesMeta, err := services.BuildPreguntasInicialesMeta(preguntasIniciales)
	if err != nil {
		fmt.Println("Preguntas iniciales meta error:", err)
		os.Exit(1)
	}

	preguntasInicialesDef, err := services.ParsePreguntasInicialesDefinition(preguntasIniciales)
	if err != nil {
		fmt.Println("Preguntas iniciales definition error:", err)
		os.Exit(1)
	}

	fmt.Println("Instrumento cargado:", instrumento.Name, instrumento.Version)

	mux := http.NewServeMux()

	nlpRunner := services.NewNLPRunner(cfg.DatabaseURL)
	nlpCloudRunClient := services.NewNLPCloudRunClientFromEnv()
	nlpJobRepository := services.NewNLPJobRepository(pool)

	nlpExecutionMode := strings.TrimSpace(
		os.Getenv("NLP_EXECUTION_MODE"),
	)
	if nlpExecutionMode == "" {
		nlpExecutionMode = services.NLPExecutionModeLocal
	}

	nlpJobs := services.NewNLPJobManager(
		nlpRunner,
		nlpCloudRunClient,
		nlpJobRepository,
		nlpExecutionMode,
	)

	fmt.Println(
		"NLP execution mode:",
		nlpExecutionMode,
	)

	// ======================
	// Health
	// ======================
	healthHandler := handlers.HealthHandler{
		DB:           pool,
		ReadyTimeout: 2 * time.Second,
	}

	// Se conserva /health por compatibilidad.
	mux.HandleFunc("/health", healthHandler.Health)
	mux.HandleFunc("/healthz", healthHandler.Health)
	mux.HandleFunc("/readyz", healthHandler.Ready)

	// ======================
	// Instrumento
	// ======================
	ih := handlers.InstrumentoHandler{Data: instrumento}
	mux.HandleFunc("/api/instrumento", ih.Get)

	pih := handlers.InstrumentoHandler{Data: preguntasIniciales}
	mux.HandleFunc("/api/preguntas-iniciales", pih.Get)

	// ======================
	// Instituciones
	// ======================
	insh := handlers.InstitucionesHandler{DB: pool}
	mux.HandleFunc("/api/instituciones/resolve", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			insh.ResolveBySlug(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Acceso publico por slug
	// ======================
	accessh := handlers.AccessHandler{DB: pool}
	mux.HandleFunc("/api/access/resolve", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			accessh.Resolve(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Encuestas
	// ======================
	eh := handlers.EncuestasHandler{DB: pool}
	mux.HandleFunc("/api/encuestas", func(w http.ResponseWriter, r *http.Request) {
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				eh.Create(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	// ======================
	// Respuestas
	// ======================
	rh := handlers.RespuestasHandler{DB: pool}
	mux.HandleFunc("/api/respuestas", func(w http.ResponseWriter, r *http.Request) {
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				rh.Save(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	rih := handlers.RespuestasInicialesHandler{DB: pool, PreguntasMeta: preguntasInicialesMeta}
	mux.HandleFunc("/api/respuestas-iniciales", func(w http.ResponseWriter, r *http.Request) {
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				rih.Save(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	// ======================
	// Resumen por encuesta
	// ======================
	rhResumen := handlers.ResumenHandler{DB: pool}
	mux.HandleFunc("/api/encuestas/", func(w http.ResponseWriter, r *http.Request) {
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				rhResumen.GetByPath(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	// ======================
	// Centros (CRUD)
	// ======================
	ch := handlers.CentrosHandler{DB: pool}

	// /api/centros → GET (público), POST (admin)
	mux.HandleFunc("/api/centros", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {

		case http.MethodGet:
			handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ch.List(w, r)
			})).ServeHTTP(w, r)
			return

		case http.MethodPost:
			handlers.RequireJWT(
				handlers.WithTenantSession(pool,
					handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						ch.Create(w, r)
					})),
				),
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
			handlers.WithTenantSession(pool,
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
			),
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
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				ah.Login(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/auth/login-global", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			ah.LoginGlobal(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Registro institucional publico
	// ======================
	rph := handlers.RegistroPublicoHandler{DB: pool}
	mux.HandleFunc("/api/registro-institucional", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			rph.Create(w, r)
			return
		}
		http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
	})

	// ======================
	// Super Admin: solicitudes de registro
	// ======================
	sah := handlers.SuperAdminHandler{DB: pool}
	mux.HandleFunc("/api/super-admin/registro-institucional", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
				handlers.RequireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Method == http.MethodGet {
						sah.ListSolicitudes(w, r)
						return
					}
					http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
				})),
			),
		).ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/super-admin/registro-institucional/", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
				handlers.RequireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					id, err := handlers.ParseSolicitudID(r.URL.Path)
					if err != nil || id <= 0 {
						http.Error(w, "bad_id", http.StatusBadRequest)
						return
					}
					switch r.Method {
					case http.MethodGet:
						sah.GetSolicitud(w, r, id)
						return
					case http.MethodPatch:
						sah.EditSolicitud(w, r, id)
						return
					case http.MethodPut:
						sah.UpdateSolicitud(w, r, id)
						return
					default:
						http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
						return
					}
				})),
			),
		).ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/super-admin/instituciones/", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
				handlers.RequireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					idStr := strings.TrimPrefix(r.URL.Path, "/api/super-admin/instituciones/")
					idStr = strings.Trim(idStr, "/")
					id, err := strconv.ParseInt(idStr, 10, 64)
					if err != nil || id <= 0 {
						http.Error(w, "bad_id", http.StatusBadRequest)
						return
					}
					switch r.Method {
					case http.MethodPatch:
						sah.EditInstitucion(w, r, id)
						return
					default:
						http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
						return
					}
				})),
			),
		).ServeHTTP(w, r)
	})

	// ======================
	// Admin: Usuarios (CRUD)
	// ======================
	auh := handlers.AdminUsuariosHandler{DB: pool}
	chConfig := handlers.ConfiguracionInstitucionHandler{DB: pool}

	// /api/admin/usuarios → GET, POST (admin)
	mux.HandleFunc("/api/admin/usuarios", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
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
			),
		).ServeHTTP(w, r)
	})

	// /api/admin/centros -> GET (admin autenticado por tenant)
	mux.HandleFunc("/api/admin/centros", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
				handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Method == http.MethodGet {
						ch.ListAdmin(w, r)
						return
					}
					http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
				})),
			),
		).ServeHTTP(w, r)
	})

	// /api/admin/usuarios/{uuid} → PUT / DELETE (admin)
	mux.HandleFunc("/api/admin/usuarios/", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
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
			),
		).ServeHTTP(w, r)
	})

	// /api/admin/configuracion -> GET / PUT (admin)
	mux.HandleFunc("/api/admin/configuracion", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(
			handlers.WithTenantSession(pool,
				handlers.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					switch r.Method {
					case http.MethodGet:
						chConfig.Get(w, r)
						return
					case http.MethodPut:
						chConfig.Upsert(w, r)
						return
					default:
						http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
						return
					}
				})),
			),
		).ServeHTTP(w, r)
	})

	// /api/tenant/branding -> GET (publico por tenant, usable por publico y paneles)
	mux.HandleFunc("/api/tenant/branding", func(w http.ResponseWriter, r *http.Request) {
		handlers.WithPublicTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				chConfig.GetBranding(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		})).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Resumen agregado (ÚNICO endpoint válido)
	// ======================
	crh := handlers.CentroResultadosHandler{
		DB:                 pool,
		PreguntasIniciales: preguntasInicialesDef,
	}
	mux.HandleFunc("/api/centro/resumen", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetResumenCentro(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Años disponibles (solo años con datos)
	// ======================
	mux.HandleFunc("/api/centro/years", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetCentroYears(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Serie anual (comparar años)
	// GET /api/centro/resumen-anual?years=2022,2023,2024
	// ======================
	mux.HandleFunc("/api/centro/resumen-anual", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetResumenCentroAnual(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Estadística avanzada (por año)
	// GET /api/centro/estadistica-avanzada?year=2025
	// ======================
	mux.HandleFunc("/api/centro/estadistica-avanzada", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				crh.GetCentroEstadisticaAvanzada(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})

	// ======================
	// Centro: Ejecutar pipeline NLP
	// POST /api/centro/nlp/procesar
	// ======================
	cnlp := handlers.CentroNLPHandler{Runner: nlpRunner, Jobs: nlpJobs}
	mux.HandleFunc("/api/centro/nlp/overview", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				cnlp.Overview(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/centro/nlp/status", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				cnlp.Status(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/centro/nlp/procesar", func(w http.ResponseWriter, r *http.Request) {
		handlers.RequireJWT(handlers.WithTenantSession(pool, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				cnlp.Process(w, r)
				return
			}
			http.Error(w, "method_not_allowed", http.StatusMethodNotAllowed)
		}))).ServeHTTP(w, r)
	})

	// ======================
	// CORS
	// ======================
	handler := handlers.CORS(mux, handlers.CORSOptions{
		AllowedOrigins: cfg.CORSAllowedOrigins,
		AllowedMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowedHeaders: "Content-Type, Authorization, X-Institucion-Slug",
	})

	server := &http.Server{
		Addr:              cfg.Address,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	serverErrors := make(chan error, 1)

	go func() {
		fmt.Println("Listening on", cfg.Address)
		serverErrors <- server.ListenAndServe()
	}()

	signalContext, stopSignals := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stopSignals()

	select {
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			fmt.Println("HTTP error:", err)
		}
	case <-signalContext.Done():
		fmt.Println("Shutdown signal received")
	}

	shutdownContext, cancelShutdown := context.WithTimeout(
		context.Background(),
		15*time.Second,
	)
	defer cancelShutdown()

	if err := server.Shutdown(shutdownContext); err != nil {
		fmt.Println("HTTP shutdown error:", err)
		_ = server.Close()
	}

	fmt.Println("HTTP server stopped")
}
