package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AdminUsuariosHandler struct {
	DB *pgxpool.Pool
}

type AdminUsuarioDTO struct {
	ID           string  `json:"id"`
	Email        string  `json:"email"`
	Nombre       string  `json:"nombre"`
	Rol          string  `json:"rol"` // admin|centro
	Activo       bool    `json:"activo"`
	Centros      []int64 `json:"centros"`
	CentroNombre string  `json:"centro_nombre,omitempty"` // útil para UI si solo 1 centro
	CreatedAt    string  `json:"created_at,omitempty"`
}

type CreateUsuarioReq struct {
	Email    string  `json:"email"`
	Nombre   string  `json:"nombre"`
	Rol      string  `json:"rol"`      // admin|centro (default centro)
	Password string  `json:"password"` // requerido en esta versión
	Centros  []int64 `json:"centros"`  // opcional
	CentroID *int64  `json:"centro_id"`
}

type UpdateUsuarioReq struct {
	Email    *string `json:"email"`
	Nombre   *string `json:"nombre"`
	Rol      *string `json:"rol"`
	Activo   *bool   `json:"activo"`
	Password *string `json:"password"` // si viene "" no cambia; si viene no-vacío cambia
	Centros  []int64 `json:"centros"`
	CentroID *int64  `json:"centro_id"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func normEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// GET /api/admin/usuarios?rol=centro|admin|all (default: centro)
func (h AdminUsuariosHandler) List(w http.ResponseWriter, r *http.Request) {
	rolQ := strings.TrimSpace(r.URL.Query().Get("rol"))
	if rolQ == "" {
		rolQ = "centro"
	}
	if rolQ != "centro" && rolQ != "admin" && rolQ != "all" {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}

	base := `
		select
			u.id::text,
			u.email,
			u.nombre,
			u.rol::text,
			u.activo,
			coalesce(array_agg(uc.centro_id order by uc.centro_id) filter (where uc.centro_id is not null), '{}') as centros,
			u.created_at::text
		from usuarios u
		left join usuario_centros uc on uc.usuario_id = u.id
	`

	var (
		q    string
		args []any
	)

	if rolQ == "all" {
		q = base + `
			group by u.id
			order by u.created_at desc
		`
		args = []any{}
	} else {
		q = base + `
			where u.rol = $1
			group by u.id
			order by u.created_at desc
		`
		args = []any{rolQ}
	}

	rows, err := h.DB.Query(r.Context(), q, args...)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]AdminUsuarioDTO, 0, 32)
	for rows.Next() {
		var it AdminUsuarioDTO
		if err := rows.Scan(&it.ID, &it.Email, &it.Nombre, &it.Rol, &it.Activo, &it.Centros, &it.CreatedAt); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		// Para UI: si tiene 1 centro, agrega su nombre
		if it.Rol == "centro" && len(it.Centros) == 1 {
			_ = h.DB.QueryRow(r.Context(), `select nombre from centros where id = $1`, it.Centros[0]).Scan(&it.CentroNombre)
		}

		out = append(out, it)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, out)
}

// POST /api/admin/usuarios
func (h AdminUsuariosHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateUsuarioReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	email := normEmail(req.Email)
	nombre := strings.TrimSpace(req.Nombre)
	rol := strings.TrimSpace(req.Rol)
	pass := strings.TrimSpace(req.Password)

	if rol == "" {
		rol = "centro"
	}
	if rol != "admin" && rol != "centro" {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}
	if email == "" || nombre == "" || !strings.Contains(email, "@") {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}
	if pass == "" {
		http.Error(w, "password_required", http.StatusBadRequest)
		return
	}
	if len(pass) < 8 {
		http.Error(w, "weak_password", http.StatusBadRequest)
		return
	}

	// Centros: soporta centro_id o centros
	centros := make([]int64, 0, 4)
	if req.CentroID != nil {
		centros = append(centros, *req.CentroID)
	} else if len(req.Centros) > 0 {
		centros = append(centros, req.Centros...)
	}

	if rol == "centro" && len(centros) == 0 {
		http.Error(w, "centro_required", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "hash_error", http.StatusInternalServerError)
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	var id string
	err = tx.QueryRow(r.Context(), `
		insert into usuarios (email, nombre, rol, password_hash, activo)
		values ($1,$2,$3,$4,true)
		returning id::text
	`, email, nombre, rol, string(hash)).Scan(&id)
	if err != nil {
		// unique email, etc
		http.Error(w, "email_exists", http.StatusConflict)
		return
	}

	if rol == "centro" {
		for _, cid := range centros {
			_, err := tx.Exec(r.Context(), `
				insert into usuario_centros (usuario_id, centro_id)
				values ($1::uuid, $2)
				on conflict do nothing
			`, id, cid)
			if err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	resp := AdminUsuarioDTO{
		ID:      id,
		Email:   email,
		Nombre:  nombre,
		Rol:     rol,
		Activo:  true,
		Centros: centros,
	}
	if resp.Rol == "centro" && len(resp.Centros) == 1 {
		_ = h.DB.QueryRow(r.Context(), `select nombre from centros where id = $1`, resp.Centros[0]).Scan(&resp.CentroNombre)
	}

	writeJSON(w, http.StatusCreated, resp)
}

// PUT /api/admin/usuarios/{uuid}
func (h AdminUsuariosHandler) Update(w http.ResponseWriter, r *http.Request, id string) {
	id = strings.TrimSpace(id)
	if id == "" {
		http.Error(w, "bad_id", http.StatusBadRequest)
		return
	}

	var req UpdateUsuarioReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// leer rol actual (y validar existencia)
	var curRol string
	err = tx.QueryRow(r.Context(), `select rol::text from usuarios where id = $1::uuid`, id).Scan(&curRol)
	if err != nil {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}

	if req.Email != nil {
		em := normEmail(*req.Email)
		if em == "" || !strings.Contains(em, "@") {
			http.Error(w, "bad_request", http.StatusBadRequest)
			return
		}
		_, err := tx.Exec(r.Context(), `update usuarios set email = $1 where id = $2::uuid`, em, id)
		if err != nil {
			http.Error(w, "email_exists", http.StatusConflict)
			return
		}
	}

	if req.Nombre != nil {
		n := strings.TrimSpace(*req.Nombre)
		if len(n) < 3 {
			http.Error(w, "bad_request", http.StatusBadRequest)
			return
		}
		_, err := tx.Exec(r.Context(), `update usuarios set nombre = $1 where id = $2::uuid`, n, id)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
	}

	if req.Rol != nil {
		nr := strings.TrimSpace(*req.Rol)
		if nr != "admin" && nr != "centro" {
			http.Error(w, "bad_request", http.StatusBadRequest)
			return
		}
		_, err := tx.Exec(r.Context(), `update usuarios set rol = $1 where id = $2::uuid`, nr, id)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		curRol = nr
	}

	if req.Activo != nil {
		_, err := tx.Exec(r.Context(), `update usuarios set activo = $1 where id = $2::uuid`, *req.Activo, id)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
	}

	if req.Password != nil {
		p := strings.TrimSpace(*req.Password)
		if p != "" {
			if len(p) < 8 {
				http.Error(w, "weak_password", http.StatusBadRequest)
				return
			}
			hash, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
			if err != nil {
				http.Error(w, "hash_error", http.StatusInternalServerError)
				return
			}
			_, err = tx.Exec(r.Context(), `update usuarios set password_hash = $1 where id = $2::uuid`, string(hash), id)
			if err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}
	}

	// Centros: reemplazo total si vienen en body
	centros := make([]int64, 0, 4)
	if req.CentroID != nil {
		centros = append(centros, *req.CentroID)
	} else if len(req.Centros) > 0 {
		centros = append(centros, req.Centros...)
	}

	if curRol == "centro" && (req.CentroID != nil || len(req.Centros) > 0) {
		if len(centros) == 0 {
			http.Error(w, "centro_required", http.StatusBadRequest)
			return
		}
		_, err := tx.Exec(r.Context(), `delete from usuario_centros where usuario_id = $1::uuid`, id)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		for _, cid := range centros {
			_, err := tx.Exec(r.Context(), `
				insert into usuario_centros (usuario_id, centro_id)
				values ($1::uuid, $2)
				on conflict do nothing
			`, id, cid)
			if err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	// devolver actualizado
	var out AdminUsuarioDTO
	err = h.DB.QueryRow(r.Context(), `
		select
			u.id::text, u.email, u.nombre, u.rol::text, u.activo,
			coalesce(array_agg(uc.centro_id order by uc.centro_id) filter (where uc.centro_id is not null), '{}') as centros,
			u.created_at::text
		from usuarios u
		left join usuario_centros uc on uc.usuario_id = u.id
		where u.id = $1::uuid
		group by u.id
	`, id).Scan(&out.ID, &out.Email, &out.Nombre, &out.Rol, &out.Activo, &out.Centros, &out.CreatedAt)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if out.Rol == "centro" && len(out.Centros) == 1 {
		_ = h.DB.QueryRow(r.Context(), `select nombre from centros where id = $1`, out.Centros[0]).Scan(&out.CentroNombre)
	}

	writeJSON(w, http.StatusOK, out)
}

// DELETE /api/admin/usuarios/{uuid}  -> soft disable
func (h AdminUsuariosHandler) Disable(w http.ResponseWriter, r *http.Request, id string) {
	id = strings.TrimSpace(id)
	if id == "" {
		http.Error(w, "bad_id", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `update usuarios set activo = false where id = $1::uuid`, id)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
