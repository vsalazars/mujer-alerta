package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CentrosHandler struct {
	DB *pgxpool.Pool
}

type CentroDTO struct {
	ID     int64  `json:"id"`
	Tipo   string `json:"tipo"`
	Nombre string `json:"nombre"`
	Slug   string `json:"slug"`
	Clave  string `json:"clave,omitempty"`
	Ciudad string `json:"ciudad,omitempty"`
	Estado string `json:"estado,omitempty"`
	Activo bool   `json:"activo,omitempty"`
}

type CentroUpsertRequest struct {
	Tipo   string `json:"tipo"`
	Nombre string `json:"nombre"`
	Clave  string `json:"clave,omitempty"`
	Ciudad string `json:"ciudad,omitempty"`
	Estado string `json:"estado,omitempty"`
}

func normalizeCentroReq(req *CentroUpsertRequest) (tipo, nombre, clave, ciudad, estado string, errCode string) {
	tipo = strings.ToLower(strings.TrimSpace(req.Tipo))
	nombre = strings.TrimSpace(req.Nombre)
	clave = strings.TrimSpace(req.Clave)
	ciudad = strings.TrimSpace(req.Ciudad)
	estado = strings.TrimSpace(req.Estado)

	if tipo != "escolar" && tipo != "laboral" {
		return "", "", "", "", "", "bad_tipo"
	}
	if nombre == "" || len(nombre) < 3 {
		return "", "", "", "", "", "bad_nombre"
	}
	if len(nombre) > 200 {
		return "", "", "", "", "", "bad_nombre"
	}
	if len(clave) > 80 || len(ciudad) > 120 || len(estado) > 120 {
		return "", "", "", "", "", "bad_request"
	}
	return tipo, nombre, clave, ciudad, estado, ""
}

var centroSlugRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugifyCentroNombre(nombre string) string {
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "ä", "a", "â", "a", "ã", "a",
		"é", "e", "è", "e", "ë", "e", "ê", "e",
		"í", "i", "ì", "i", "ï", "i", "î", "i",
		"ó", "o", "ò", "o", "ö", "o", "ô", "o", "õ", "o",
		"ú", "u", "ù", "u", "ü", "u", "û", "u",
		"ñ", "n", "ç", "c",
	)

	slug := strings.ToLower(strings.TrimSpace(nombre))
	slug = replacer.Replace(slug)
	slug = centroSlugRegex.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "centro"
	}
	if len(slug) > 80 {
		slug = strings.Trim(slug[:80], "-")
	}
	if slug == "" {
		slug = "centro"
	}
	return slug
}

func ensureUniqueCentroSlug(r *http.Request, db *pgxpool.Pool, institucionID int64, desired string, excludeID int64) (string, error) {
	base := slugifyCentroNombre(desired)
	candidate := base

	for n := 1; n <= 500; n++ {
		var exists bool
		err := queryRow(r.Context(), db, `
			select exists(
				select 1
				from centros
				where institucion_id = $1
				  and slug = $2
				  and ($3 = 0 or id <> $3)
			)
		`, institucionID, candidate, excludeID).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}

		suffix := "-" + strconv.Itoa(n+1)
		maxBaseLen := 80 - len(suffix)
		trimmedBase := base
		if len(trimmedBase) > maxBaseLen {
			trimmedBase = strings.Trim(trimmedBase[:maxBaseLen], "-")
		}
		if trimmedBase == "" {
			trimmedBase = "centro"
		}
		candidate = trimmedBase + suffix
	}

	return "", errors.New("could_not_generate_unique_centro_slug")
}

// PUBLICO: solo activos
func (h CentrosHandler) List(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := strings.TrimSpace(r.URL.Query().Get("tipo"))
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	limit := 20
	if s := strings.TrimSpace(r.URL.Query().Get("limit")); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 1 && v <= 100 {
			limit = v
		}
	}

	args := []any{institucionID}
	where := []string{"institucion_id = $1", "activo = true"}

	if tipo != "" {
		if tipo != "escolar" && tipo != "laboral" {
			http.Error(w, "bad_tipo", http.StatusBadRequest)
			return
		}
		args = append(args, tipo)
		where = append(where, "tipo = $"+strconv.Itoa(len(args)))
	}

	if q != "" {
		args = append(args, "%"+q+"%")
		where = append(where, "nombre ilike $"+strconv.Itoa(len(args)))
	}

	args = append(args, limit)

	sql := `
		select id, tipo, nombre, slug, coalesce(clave,''), coalesce(ciudad,''), coalesce(estado,'')
		from centros
		where ` + strings.Join(where, " and ") + `
		order by nombre asc
		limit $` + strconv.Itoa(len(args))

	rows, err := query(r.Context(), h.DB, sql, args...)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]CentroDTO, 0, limit)
	for rows.Next() {
		var c CentroDTO
		if err := rows.Scan(&c.ID, &c.Tipo, &c.Nombre, &c.Slug, &c.Clave, &c.Ciudad, &c.Estado); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		out = append(out, c)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}

// ADMIN: lista todos los centros del tenant, incluidos inactivos
func (h CentrosHandler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := strings.TrimSpace(r.URL.Query().Get("tipo"))
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	limit := 100
	args := []any{institucionID}
	where := []string{"institucion_id = $1"}

	if tipo != "" {
		if tipo != "escolar" && tipo != "laboral" {
			http.Error(w, "bad_tipo", http.StatusBadRequest)
			return
		}
		args = append(args, tipo)
		where = append(where, "tipo = $"+strconv.Itoa(len(args)))
	}

	if q != "" {
		args = append(args, "%"+q+"%")
		where = append(where, "nombre ilike $"+strconv.Itoa(len(args)))
	}

	args = append(args, limit)

	sql := `
		select id, tipo, nombre, slug, coalesce(clave,''), coalesce(ciudad,''), coalesce(estado,''), activo
		from centros
		where ` + strings.Join(where, " and ") + `
		order by activo desc, nombre asc
		limit $` + strconv.Itoa(len(args))

	rows, err := query(r.Context(), h.DB, sql, args...)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]CentroDTO, 0, limit)
	for rows.Next() {
		var c CentroDTO
		if err := rows.Scan(&c.ID, &c.Tipo, &c.Nombre, &c.Slug, &c.Clave, &c.Ciudad, &c.Estado, &c.Activo); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		out = append(out, c)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}

// ADMIN: crear
func (h CentrosHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CentroUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	tipo, nombre, clave, ciudad, estado, errCode := normalizeCentroReq(&req)
	if errCode != "" {
		http.Error(w, errCode, http.StatusBadRequest)
		return
	}

	var id int64
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	slug, err := ensureUniqueCentroSlug(r, h.DB, institucionID, nombre, 0)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	err = queryRow(r.Context(), h.DB, `
		insert into centros (tipo, nombre, slug, clave, ciudad, estado, activo, institucion_id)
		values ($1, $2, $3, nullif($4,''), nullif($5,''), nullif($6,''), true, $7)
		returning id
	`, tipo, nombre, slug, clave, ciudad, estado, institucionID).Scan(&id)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(CentroDTO{
		ID:     id,
		Tipo:   tipo,
		Nombre: nombre,
		Slug:   slug,
		Clave:  clave,
		Ciudad: ciudad,
		Estado: estado,
		Activo: true,
	})
}

// ADMIN: obtener por id (incluye activo/inactivo)
func (h CentrosHandler) GetByID(w http.ResponseWriter, r *http.Request, id int64) {
	var c CentroDTO
	err := queryRow(r.Context(), h.DB, `
		select id, tipo, nombre, slug, coalesce(clave,''), coalesce(ciudad,''), coalesce(estado,''), activo
		from centros
		where id = $1
	`, id).Scan(&c.ID, &c.Tipo, &c.Nombre, &c.Slug, &c.Clave, &c.Ciudad, &c.Estado, &c.Activo)

	if err != nil {
		http.Error(w, "centro_not_found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(c)
}

// ADMIN: actualizar
func (h CentrosHandler) Update(w http.ResponseWriter, r *http.Request, id int64) {
	var req CentroUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	tipo, nombre, clave, ciudad, estado, errCode := normalizeCentroReq(&req)
	if errCode != "" {
		http.Error(w, errCode, http.StatusBadRequest)
		return
	}

	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	slug, err := ensureUniqueCentroSlug(r, h.DB, institucionID, nombre, id)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	ct, err := exec(r.Context(), h.DB, `
		update centros
		set tipo = $2,
		    nombre = $3,
		    slug = $4,
		    clave = nullif($5,''),
		    ciudad = nullif($6,''),
		    estado = nullif($7,'')
		where id = $1
	`, id, tipo, nombre, slug, clave, ciudad, estado)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		http.Error(w, "centro_not_found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(CentroDTO{
		ID:     id,
		Tipo:   tipo,
		Nombre: nombre,
		Slug:   slug,
		Clave:  clave,
		Ciudad: ciudad,
		Estado: estado,
	})
}

// ADMIN: delete lógico
func (h CentrosHandler) Delete(w http.ResponseWriter, r *http.Request, id int64) {
	var usuariosCount int64
	if err := queryRow(r.Context(), h.DB, `
		select count(*)
		from usuario_centros
		where centro_id = $1
	`, id).Scan(&usuariosCount); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	var encuestasCount int64
	if err := queryRow(r.Context(), h.DB, `
		select count(*)
		from encuestas
		where centro_id = $1
	`, id).Scan(&encuestasCount); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if usuariosCount > 0 || encuestasCount > 0 {
		http.Error(w, "centro_has_data", http.StatusConflict)
		return
	}

	ct, err := exec(r.Context(), h.DB, `
		delete from centros
		where id = $1
	`, id)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		http.Error(w, "centro_not_found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
