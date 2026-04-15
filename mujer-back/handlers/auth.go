package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"sort"
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
	Token           string   `json:"token"`
	UserID          string   `json:"user_id"`
	Email           string   `json:"email"`
	Nombre          string   `json:"nombre"`
	Rol             string   `json:"rol"`
	InstitucionID   int64    `json:"institucion_id"`
	InstitucionSlug string   `json:"institucion_slug"`
	Centros         []int64  `json:"centros"`
	CentroNombres   []string `json:"centro_nombres,omitempty"`
	ExpiresAt       int64    `json:"expires_at"`
}

type loginCandidate struct {
	UserID          string
	Email           string
	Nombre          string
	Rol             string
	PasswordHash    string
	Activo          bool
	InstitucionID   int64
	InstitucionSlug string
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

	var candidate loginCandidate
	err := queryRow(r.Context(), h.DB, `
		select u.id::text, u.email, u.nombre, u.rol::text, u.password_hash, u.activo, u.institucion_id, i.slug
		from usuarios u
		join instituciones i on i.id = u.institucion_id
		where lower(email) = $1
		order by created_at asc
		limit 1
	`, email).Scan(
		&candidate.UserID,
		&candidate.Email,
		&candidate.Nombre,
		&candidate.Rol,
		&candidate.PasswordHash,
		&candidate.Activo,
		&candidate.InstitucionID,
		&candidate.InstitucionSlug,
	)
	if err != nil {
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	}
	if !candidate.Activo {
		http.Error(w, "user_inactive", http.StatusForbidden)
		return
	}

	ok, err := h.verifyPassword(r, candidate.PasswordHash, pass)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	}

	h.respondLoginSuccess(w, r, candidate)
}

func (h AuthHandler) LoginGlobal(w http.ResponseWriter, r *http.Request) {
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

	rows, err := query(r.Context(), h.DB, `
		select user_id::text, email, nombre, rol, password_hash, activo, institucion_id, institucion_slug
		from public.app_login_candidates_by_email($1)
	`, email)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	candidates := make([]loginCandidate, 0, 4)
	for rows.Next() {
		var candidate loginCandidate
		if err := rows.Scan(
			&candidate.UserID,
			&candidate.Email,
			&candidate.Nombre,
			&candidate.Rol,
			&candidate.PasswordHash,
			&candidate.Activo,
			&candidate.InstitucionID,
			&candidate.InstitucionSlug,
		); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		candidates = append(candidates, candidate)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if len(candidates) == 0 {
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	}

	matches := make([]loginCandidate, 0, 2)
	inactiveMatches := make([]loginCandidate, 0, 1)
	for _, candidate := range candidates {
		ok, err := h.verifyPassword(r, candidate.PasswordHash, pass)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if !ok {
			continue
		}
		if candidate.Activo {
			matches = append(matches, candidate)
		} else {
			inactiveMatches = append(inactiveMatches, candidate)
		}
	}

	switch len(matches) {
	case 0:
		if len(inactiveMatches) > 0 {
			http.Error(w, "user_inactive", http.StatusForbidden)
			return
		}
		http.Error(w, "invalid_credentials", http.StatusUnauthorized)
		return
	case 1:
		h.respondLoginSuccess(w, r, matches[0])
		return
	default:
		sort.Slice(matches, func(i, j int) bool {
			if matches[i].InstitucionSlug == matches[j].InstitucionSlug {
				return matches[i].UserID < matches[j].UserID
			}
			return matches[i].InstitucionSlug < matches[j].InstitucionSlug
		})
		http.Error(w, "multiple_accounts_same_email", http.StatusConflict)
		return
	}
}

func (h AuthHandler) verifyPassword(r *http.Request, passwordHash, pass string) (bool, error) {
	ok := false
	if strings.HasPrefix(passwordHash, "$2a$") || strings.HasPrefix(passwordHash, "$2b$") || strings.HasPrefix(passwordHash, "$2y$") {
		if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(pass)) == nil {
			ok = true
		}
	} else {
		var match bool
		if err := queryRow(r.Context(), h.DB, `select ($1 = crypt($2, $1))`, passwordHash, pass).Scan(&match); err != nil {
			return false, err
		}
		ok = match
	}
	return ok, nil
}

func (h AuthHandler) respondLoginSuccess(w http.ResponseWriter, r *http.Request, candidate loginCandidate) {
	userID := candidate.UserID
	email := candidate.Email
	nombre := candidate.Nombre
	rol := candidate.Rol
	institucionID := candidate.InstitucionID

	centros := make([]int64, 0, 8)
	centroNombres := make([]string, 0, 8)
	rows, err := query(r.Context(), h.DB, `
		select uc.centro_id, coalesce(c.nombre, '')
		from usuario_centros uc
		left join centros c on c.id = uc.centro_id
		where usuario_id = $1::uuid
		order by uc.centro_id asc
	`, userID)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cid int64
		var centroNombre string
		if err := rows.Scan(&cid, &centroNombre); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		centros = append(centros, cid)
		centroNombres = append(centroNombres, centroNombre)
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
		"sub":              userID,
		"email":            email,
		"nombre":           nombre,
		"rol":              rol,
		"institucion_id":   institucionID,
		"institucion_slug": candidate.InstitucionSlug,
		"centros":          centros,
		"centro_nombres":   centroNombres,
		"iat":              now.Unix(),
		"exp":              exp.Unix(),
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
		Token:           signed,
		UserID:          userID,
		Email:           email,
		Nombre:          nombre,
		Rol:             rol,
		InstitucionID:   institucionID,
		InstitucionSlug: candidate.InstitucionSlug,
		Centros:         centros,
		CentroNombres:   centroNombres,
		ExpiresAt:       exp.Unix(),
	})
}
