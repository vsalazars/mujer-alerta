package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const (
	ctxUserID   ctxKey = "user_id"
	ctxUserRol  ctxKey = "user_rol"
	ctxCentros  ctxKey = "user_centros"
	ctxUserMail ctxKey = "user_email"
)

func UserIDFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(ctxUserID).(string)
	return v
}
func UserRolFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(ctxUserRol).(string)
	return v
}
func UserCentrosFromCtx(ctx context.Context) []int64 {
	v, _ := ctx.Value(ctxCentros).([]int64)
	return v
}
func UserEmailFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(ctxUserMail).(string)
	return v
}

func RequireJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
		if secret == "" {
			http.Error(w, "missing_jwt_secret", http.StatusInternalServerError)
			return
		}

		auth := r.Header.Get("Authorization")
		if auth == "" {
			http.Error(w, "missing_auth", http.StatusUnauthorized)
			return
		}

		m := strings.TrimSpace(auth)
		if !strings.HasPrefix(strings.ToLower(m), "bearer ") {
			http.Error(w, "bad_auth", http.StatusUnauthorized)
			return
		}
		raw := strings.TrimSpace(m[len("bearer "):])
		if raw == "" {
			http.Error(w, "bad_auth", http.StatusUnauthorized)
			return
		}

		parsed, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})
		if err != nil || !parsed.Valid {
			http.Error(w, "invalid_token", http.StatusUnauthorized)
			return
		}

		claims, ok := parsed.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid_token", http.StatusUnauthorized)
			return
		}

		sub, _ := claims["sub"].(string)
		rol, _ := claims["rol"].(string)
		email, _ := claims["email"].(string)

		centros := []int64{}
		if arr, ok := claims["centros"].([]any); ok {
			for _, x := range arr {
				switch v := x.(type) {
				case float64:
					centros = append(centros, int64(v))
				case int64:
					centros = append(centros, v)
				}
			}
		}

		if strings.TrimSpace(sub) == "" || strings.TrimSpace(rol) == "" {
			http.Error(w, "invalid_token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), ctxUserID, sub)
		ctx = context.WithValue(ctx, ctxUserRol, rol)
		ctx = context.WithValue(ctx, ctxCentros, centros)
		ctx = context.WithValue(ctx, ctxUserMail, email)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if UserRolFromCtx(r.Context()) != "admin" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
