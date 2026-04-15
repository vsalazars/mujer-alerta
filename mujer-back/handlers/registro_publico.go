package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RegistroPublicoHandler struct {
	DB *pgxpool.Pool
}

type RegistroInstitucionalRequest struct {
	InstitucionNombre string `json:"institucion_nombre"`
	Tipo              string `json:"tipo"`
	NombreContacto    string `json:"nombre_contacto"`
	CargoContacto     string `json:"cargo_contacto"`
	EmailContacto     string `json:"email_contacto"`
	TelefonoContacto  string `json:"telefono_contacto"`
	Estado            string `json:"estado"`
	Ciudad            string `json:"ciudad"`
	SitioWeb          string `json:"sitio_web"`
}

type RegistroInstitucionalResponse struct {
	ID                int64  `json:"id"`
	Estatus           string `json:"estatus"`
	InstitucionNombre string `json:"institucion_nombre"`
	SlugDeseado       string `json:"slug_deseado,omitempty"`
}

var registroSlugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func normalizeOptional(s string) string {
	return strings.TrimSpace(s)
}

func normalizeEmailRegistro(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func slugifyRegistroBase(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
			lastDash = false
		case r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case r == ' ' || r == '-' || r == '_' || r == '.' || r == '/':
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	out := strings.Trim(b.String(), "-")
	return out
}

func (h RegistroPublicoHandler) slugExists(r *http.Request, slug string) (bool, error) {
	var exists bool
	if err := queryRow(r.Context(), h.DB, `
		select exists(
			select 1 from public.instituciones where lower(slug) = $1
			union all
			select 1 from public.registro_institucional_solicitudes where lower(slug_deseado) = $1
		)
	`, strings.ToLower(slug)).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (h RegistroPublicoHandler) buildUniqueSlug(r *http.Request, institucionNombre string) (string, error) {
	base := slugifyRegistroBase(institucionNombre)
	if base == "" {
		base = "institucion"
	}
	if !registroSlugRegex.MatchString(base) {
		base = "institucion"
	}

	candidate := base
	for n := 0; n < 500; n++ {
		if n > 0 {
			candidate = fmt.Sprintf("%s-%d", base, n+1)
		}
		exists, err := h.slugExists(r, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("unique slug not found")
}

func (h RegistroPublicoHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req RegistroInstitucionalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	institucionNombre := normalizeOptional(req.InstitucionNombre)
	tipo := normalizeOptional(req.Tipo)
	nombreContacto := normalizeOptional(req.NombreContacto)
	cargoContacto := normalizeOptional(req.CargoContacto)
	emailContacto := normalizeEmailRegistro(req.EmailContacto)
	telefonoContacto := normalizeOptional(req.TelefonoContacto)
	estado := normalizeOptional(req.Estado)
	ciudad := normalizeOptional(req.Ciudad)
	sitioWeb := normalizeOptional(req.SitioWeb)

	if tipo == "" {
		tipo = "institucion"
	}
	if tipo != "universidad" && tipo != "empresa" && tipo != "institucion" {
		http.Error(w, "bad_tipo", http.StatusBadRequest)
		return
	}
	if institucionNombre == "" || nombreContacto == "" || emailContacto == "" {
		http.Error(w, "missing_required_fields", http.StatusBadRequest)
		return
	}
	if !strings.Contains(emailContacto, "@") {
		http.Error(w, "bad_email", http.StatusBadRequest)
		return
	}

	var pendingID int64
	err := queryRow(r.Context(), h.DB, `
		select id
		from public.registro_institucional_solicitudes
		where lower(email_contacto) = $1
		  and estatus in ('pendiente', 'contactado')
		order by created_at desc
		limit 1
	`, emailContacto).Scan(&pendingID)
	if err == nil && pendingID > 0 {
		http.Error(w, "request_already_exists", http.StatusConflict)
		return
	}

	slugDeseado, err := h.buildUniqueSlug(r, institucionNombre)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	var resp RegistroInstitucionalResponse
	err = queryRow(r.Context(), h.DB, `
		insert into public.registro_institucional_solicitudes (
			institucion_nombre,
			tipo,
			nombre_contacto,
			cargo_contacto,
			email_contacto,
			telefono_contacto,
			estado,
			ciudad,
			sitio_web,
			slug_deseado
		)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		returning id, estatus, institucion_nombre, coalesce(slug_deseado, '')
	`, institucionNombre, tipo, nombreContacto, cargoContacto, emailContacto, telefonoContacto, estado, ciudad, sitioWeb, slugDeseado).Scan(
		&resp.ID,
		&resp.Estatus,
		&resp.InstitucionNombre,
		&resp.SlugDeseado,
	)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}
