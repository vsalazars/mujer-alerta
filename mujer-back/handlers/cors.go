package handlers

import (
	"net/http"
	"strings"
)

type CORSOptions struct {
	AllowedOrigins []string
	AllowedMethods string
	AllowedHeaders string
}

func CORS(next http.Handler, opt CORSOptions) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		allowed := ""
		if origin != "" {
			for _, o := range opt.AllowedOrigins {
				if o == origin {
					allowed = origin
					break
				}
			}
		}

		if allowed != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowed)
			w.Header().Set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
			w.Header().Set("Access-Control-Allow-Methods", opt.AllowedMethods)

			requestHeaders := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
			if requestHeaders != "" {
				w.Header().Set("Access-Control-Allow-Headers", requestHeaders)
			} else {
				w.Header().Set("Access-Control-Allow-Headers", opt.AllowedHeaders)
			}

			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
