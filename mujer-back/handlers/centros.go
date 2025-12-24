package handlers

import (
	"encoding/json"
	"net/http"
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

// PUBLICO: solo activos
func (h CentrosHandler) List(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := strings.TrimSpace(r.URL.Query().Get("tipo"))

	limit := 20
	if s := strings.TrimSpace(r.URL.Query().Get("limit")); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 1 && v <= 100 {
			limit = v
		}
	}

	args := []any{}
	where := []string{"activo = true"}

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
		select id, tipo, nombre, coalesce(clave,''), coalesce(ciudad,''), coalesce(estado,'')
		from centros
		where ` + strings.Join(where, " and ") + `
		order by nombre asc
		limit $` + strconv.Itoa(len(args))

	rows, err := h.DB.Query(r.Context(), sql, args...)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]CentroDTO, 0, limit)
	for rows.Next() {
		var c CentroDTO
		if err := rows.Scan(&c.ID, &c.Tipo, &c.Nombre, &c.Clave, &c.Ciudad, &c.Estado); err != nil {
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
	err := h.DB.QueryRow(r.Context(), `
		insert into centros (tipo, nombre, clave, ciudad, estado, activo)
		values ($1, $2, nullif($3,''), nullif($4,''), nullif($5,''), true)
		returning id
	`, tipo, nombre, clave, ciudad, estado).Scan(&id)
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
		Clave:  clave,
		Ciudad: ciudad,
		Estado: estado,
		Activo: true,
	})
}

// ADMIN: obtener por id (incluye activo/inactivo)
func (h CentrosHandler) GetByID(w http.ResponseWriter, r *http.Request, id int64) {
	var c CentroDTO
	err := h.DB.QueryRow(r.Context(), `
		select id, tipo, nombre, coalesce(clave,''), coalesce(ciudad,''), coalesce(estado,''), activo
		from centros
		where id = $1
	`, id).Scan(&c.ID, &c.Tipo, &c.Nombre, &c.Clave, &c.Ciudad, &c.Estado, &c.Activo)

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

	ct, err := h.DB.Exec(r.Context(), `
		update centros
		set tipo = $2,
		    nombre = $3,
		    clave = nullif($4,''),
		    ciudad = nullif($5,''),
		    estado = nullif($6,'')
		where id = $1
	`, id, tipo, nombre, clave, ciudad, estado)
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
		Clave:  clave,
		Ciudad: ciudad,
		Estado: estado,
	})
}

// ADMIN: delete lógico
func (h CentrosHandler) Delete(w http.ResponseWriter, r *http.Request, id int64) {
	ct, err := h.DB.Exec(r.Context(), `
		update centros
		set activo = false
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
