package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type InstitucionesHandler struct {
	DB *pgxpool.Pool
}

type InstitucionPublicDTO struct {
	ID     int64  `json:"id"`
	Nombre string `json:"nombre"`
	Slug   string `json:"slug"`
}

func (h InstitucionesHandler) ResolveBySlug(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		http.Error(w, "missing_slug", http.StatusBadRequest)
		return
	}

	var out InstitucionPublicDTO
	err := queryRow(r.Context(), h.DB, `
		select i.id, i.nombre, i.slug
		from public.instituciones i
		where i.id = public.app_resolve_institucion_id_by_slug($1)
	`, slug).Scan(&out.ID, &out.Nombre, &out.Slug)
	if err != nil {
		http.Error(w, "institucion_not_found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}
