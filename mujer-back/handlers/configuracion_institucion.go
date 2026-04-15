package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ConfiguracionInstitucionHandler struct {
	DB *pgxpool.Pool
}

type ConfiguracionInstitucionDTO struct {
	InstitucionID               int64  `json:"institucion_id"`
	NombrePublico               string `json:"nombre_publico,omitempty"`
	LogoURL                     string `json:"logo_url,omitempty"`
	ColorPrimario               string `json:"color_primario,omitempty"`
	ColorSecundario             string `json:"color_secundario,omitempty"`
	ColorApoyo                  string `json:"color_apoyo,omitempty"`
	DominioPermitido            string `json:"dominio_permitido,omitempty"`
	PermiteAutoregistro         bool   `json:"permite_autoregistro"`
	RequiereCorreoInstitucional bool   `json:"requiere_correo_institucional"`
}

type TenantBrandingDTO struct {
	InstitucionID   int64  `json:"institucion_id"`
	NombrePublico   string `json:"nombre_publico,omitempty"`
	LogoURL         string `json:"logo_url,omitempty"`
	ColorPrimario   string `json:"color_primario,omitempty"`
	ColorSecundario string `json:"color_secundario,omitempty"`
	ColorApoyo      string `json:"color_apoyo,omitempty"`
}

type UpdateConfiguracionInstitucionReq struct {
	NombrePublico               string `json:"nombre_publico"`
	LogoURL                     string `json:"logo_url"`
	ColorPrimario               string `json:"color_primario"`
	ColorSecundario             string `json:"color_secundario"`
	ColorApoyo                  string `json:"color_apoyo"`
	DominioPermitido            string `json:"dominio_permitido"`
	PermiteAutoregistro         bool   `json:"permite_autoregistro"`
	RequiereCorreoInstitucional bool   `json:"requiere_correo_institucional"`
}

func (h ConfiguracionInstitucionHandler) Get(w http.ResponseWriter, r *http.Request) {
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var out ConfiguracionInstitucionDTO
	err := queryRow(r.Context(), h.DB, `
		select
			institucion_id,
			coalesce(nombre_publico, ''),
			coalesce(logo_url, ''),
			coalesce(color_primario, ''),
			coalesce(color_secundario, ''),
			coalesce(color_apoyo, ''),
			coalesce(dominio_permitido, ''),
			permite_autoregistro,
			requiere_correo_institucional
		from configuracion_institucion
		where institucion_id = $1
	`, institucionID).Scan(
		&out.InstitucionID,
		&out.NombrePublico,
		&out.LogoURL,
		&out.ColorPrimario,
		&out.ColorSecundario,
		&out.ColorApoyo,
		&out.DominioPermitido,
		&out.PermiteAutoregistro,
		&out.RequiereCorreoInstitucional,
	)
	if err != nil {
		http.Error(w, "config_not_found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h ConfiguracionInstitucionHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req UpdateConfiguracionInstitucionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	nombrePublico := strings.TrimSpace(req.NombrePublico)
	logoURL := strings.TrimSpace(req.LogoURL)
	colorPrimario := strings.TrimSpace(req.ColorPrimario)
	colorSecundario := strings.TrimSpace(req.ColorSecundario)
	colorApoyo := strings.TrimSpace(req.ColorApoyo)
	dominioPermitido := strings.TrimSpace(req.DominioPermitido)

	if len(nombrePublico) > 200 || len(colorPrimario) > 32 || len(colorSecundario) > 32 || len(colorApoyo) > 32 || len(dominioPermitido) > 255 {
		http.Error(w, "bad_request", http.StatusBadRequest)
		return
	}
	if len(logoURL) > 2_000_000 {
		http.Error(w, "logo_too_large", http.StatusBadRequest)
		return
	}

	_, err := exec(r.Context(), h.DB, `
		insert into configuracion_institucion (
			institucion_id,
			nombre_publico,
			logo_url,
			color_primario,
			color_secundario,
			color_apoyo,
			dominio_permitido,
			permite_autoregistro,
			requiere_correo_institucional
		)
		values ($1, nullif($2,''), nullif($3,''), nullif($4,''), nullif($5,''), nullif($6,''), nullif($7,''), $8, $9)
		on conflict (institucion_id) do update
		set nombre_publico = excluded.nombre_publico,
		    logo_url = excluded.logo_url,
		    color_primario = excluded.color_primario,
		    color_secundario = excluded.color_secundario,
		    color_apoyo = excluded.color_apoyo,
		    dominio_permitido = excluded.dominio_permitido,
		    permite_autoregistro = excluded.permite_autoregistro,
		    requiere_correo_institucional = excluded.requiere_correo_institucional,
		    updated_at = now()
	`, institucionID, nombrePublico, logoURL, colorPrimario, colorSecundario, colorApoyo, dominioPermitido, req.PermiteAutoregistro, req.RequiereCorreoInstitucional)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, ConfiguracionInstitucionDTO{
		InstitucionID:               institucionID,
		NombrePublico:               nombrePublico,
		LogoURL:                     logoURL,
		ColorPrimario:               colorPrimario,
		ColorSecundario:             colorSecundario,
		ColorApoyo:                  colorApoyo,
		DominioPermitido:            dominioPermitido,
		PermiteAutoregistro:         req.PermiteAutoregistro,
		RequiereCorreoInstitucional: req.RequiereCorreoInstitucional,
	})
}

func (h ConfiguracionInstitucionHandler) GetBranding(w http.ResponseWriter, r *http.Request) {
	institucionID, ok := UserInstitucionIDFromCtx(r.Context())
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var out TenantBrandingDTO
	err := queryRow(r.Context(), h.DB, `
		select
			i.id,
			coalesce(nullif(ci.nombre_publico, ''), i.nombre),
			coalesce(ci.logo_url, ''),
			coalesce(ci.color_primario, ''),
			coalesce(ci.color_secundario, ''),
			coalesce(ci.color_apoyo, '')
		from instituciones i
		left join configuracion_institucion ci
			on ci.institucion_id = i.id
		where i.id = $1
	`, institucionID).Scan(
		&out.InstitucionID,
		&out.NombrePublico,
		&out.LogoURL,
		&out.ColorPrimario,
		&out.ColorSecundario,
		&out.ColorApoyo,
	)
	if err != nil {
		http.Error(w, "institucion_not_found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, out)
}
