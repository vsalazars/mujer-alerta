package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AccessHandler struct {
	DB *pgxpool.Pool
}

type PublicAccessResolution struct {
	Kind            string `json:"kind"`
	InstitucionID   int64  `json:"institucion_id"`
	InstitucionSlug string `json:"institucion_slug"`
	CentroID        int64  `json:"centro_id,omitempty"`
	CentroSlug      string `json:"centro_slug,omitempty"`
	TargetPath      string `json:"target_path"`
}

func (h AccessHandler) Resolve(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		http.Error(w, "missing_slug", http.StatusBadRequest)
		return
	}

	var out PublicAccessResolution
	err := queryRow(r.Context(), h.DB, `
		select kind, institucion_id, institucion_slug, coalesce(centro_id, 0), coalesce(centro_slug, '')
		from public.app_resolve_public_access_slug($1)
	`, slug).Scan(&out.Kind, &out.InstitucionID, &out.InstitucionSlug, &out.CentroID, &out.CentroSlug)
	if err != nil {
		http.Error(w, "slug_not_found", http.StatusNotFound)
		return
	}

	switch out.Kind {
	case "institucion":
		out.TargetPath = "/" + out.InstitucionSlug + "/diagnostico"
	case "centro":
		out.TargetPath = "/" + out.InstitucionSlug + "/diagnostico?centro_slug=" + out.CentroSlug
	default:
		http.Error(w, "slug_not_found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}
