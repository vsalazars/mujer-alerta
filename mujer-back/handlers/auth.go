package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token         string  `json:"token"`
	UserID        string  `json:"user_id"`
	Email         string  `json:"email"`
	Nombre        string  `json:"nombre"`
	Rol           string  `json:"rol"`
	InstitucionID int64   `json:"institucion_id"`
	Centros       []int64 `json:"centros"`
	ExpiresAt     int64   `json:"expires_at"`
}

func (h AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	pass := strings.TrimSpace(req.Password)
	if email == "" || pass == "" {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}

	var userID, nombre, rol, passwordHash string
	var institucionID int64
	var activo bool

	err := queryRow(r.Context(), h.DB, `
		select id::text, nombre, rol::text, password_hash, activo, institucion_id
		from usuarios
		where lower(email) = $1
		order by created_at asc
		limit 1
	`, email).Scan(&userID, &nombre, &rol, &passwordHash, &activo, &institucionID)
	if err != nil {
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	}
	if !activo {
		http.Error(w, "user_inactive", http.StatusForbidden)
		return
	}

	// Compatibilidad:
	// - Si password_hash empieza con "$2" asumimos bcrypt (recomendado)
	// - Si no, caemos a validación PostgreSQL crypt()
	ok := false
	if strings.HasPrefix(passwordHash, "$2a$") || strings.HasPrefix(passwordHash, "$2b$") || strings.HasPrefix(passwordHash, "$2y$") {
		if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(pass)) == nil {
			ok = true
		}
	} else {
		// Postgres crypt fallback (para tu seed actual si lo hiciste con crypt())
		var match bool
		_ = queryRow(r.Context(), h.DB, `select ($1 = crypt($2, $1))`, passwordHash, pass).Scan(&match)
		ok = match
	}

	if !ok {
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	}

	centros := make([]int64, 0, 8)
	rows, err := query(r.Context(), h.DB, `
		select centro_id
		from usuario_centros
		where usuario_id = $1::uuid
		order by centro_id asc
	`, userID)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cid int64
		if err := rows.Scan(&cid); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		centros = append(centros, cid)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		http.Error(w, "missing_jwt_secret", http.StatusInternalServerError)
		return
	}

	now := time.Now()
	exp := now.Add(7 * 24 * time.Hour)

	claims := jwt.MapClaims{
		"sub":            userID,
		"email":          email,
		"nombre":         nombre,
		"rol":            rol,
		"institucion_id": institucionID,
		"centros":        centros,
		"iat":            now.Unix(),
		"exp":            exp.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		http.Error(w, "token_error", http.StatusInternalServerError)
		return
	}

	_, _ = exec(r.Context(), h.DB, `update usuarios set last_login_at = now() where id = $1::uuid`, userID)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(LoginResponse{
		Token:         signed,
		UserID:        userID,
		Email:         email,
		Nombre:        nombre,
		Rol:           rol,
		InstitucionID: institucionID,
		Centros:       centros,
		ExpiresAt:     exp.Unix(),
	})
}
