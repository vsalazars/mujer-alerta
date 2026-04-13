package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"mujer-back/services"
)

type CentroNLPHandler struct {
	Runner services.NLPRunner
	Jobs   *services.NLPJobManager
}

type CentroNLPProcessRequest struct {
	Limit      *int   `json:"limit"`
	EncuestaID string `json:"encuesta_id"`
	Year       *int   `json:"year"`
	DryRun     bool   `json:"dry_run"`
}

type CentroNLPProcessResponse struct {
	Centros []int64                `json:"centros"`
	Started bool                   `json:"started"`
	Status  services.NLPJobStatus  `json:"status"`
	Result  *services.NLPRunResult `json:"result,omitempty"`
}

type NLPCatalogItem struct {
	Clave    string `json:"clave"`
	Etiqueta string `json:"etiqueta"`
}

type CentroNLPOverviewResponse struct {
	Centros          []int64          `json:"centros"`
	Year             *int             `json:"year,omitempty"`
	TotalComentarios int64            `json:"total_comentarios"`
	TotalProcesados  int64            `json:"total_procesados"`
	TotalPendientes  int64            `json:"total_pendientes"`
	TotalError       int64            `json:"total_error"`
	AvancePorcentaje float64          `json:"avance_porcentaje"`
	PorSentimiento   []CountItem      `json:"por_sentimiento"`
	PorEmocion       []CountItem      `json:"por_emocion"`
	PorTema          []CountItem      `json:"por_tema"`
	CatalogoTemas    []NLPCatalogItem `json:"catalogo_temas"`
}

type CentroNLPStatusResponse struct {
	Centros []int64               `json:"centros"`
	Year    *int                  `json:"year,omitempty"`
	Status  services.NLPJobStatus `json:"status"`
}

var nlpThemeCatalog = []NLPCatalogItem{
	{Clave: "tv1_descalificacion_humillacion", Etiqueta: "Descalificacion o humillacion"},
	{Clave: "tv2_discriminacion_por_ser_mujer", Etiqueta: "Discriminacion por ser mujer"},
	{Clave: "tv3_sexualizacion_comentarios_sexuales", Etiqueta: "Sexualizacion o comentarios sexuales"},
	{Clave: "tv4_hostigamiento_sexual", Etiqueta: "Hostigamiento sexual"},
	{Clave: "tv5_abuso_de_poder", Etiqueta: "Abuso de poder o autoridad"},
	{Clave: "tv6_obstaculizacion_academica_laboral", Etiqueta: "Obstaculizacion academica o laboral"},
	{Clave: "tv7_violencia_digital", Etiqueta: "Violencia digital o mediatica"},
	{Clave: "tv8_agresion_o_amenaza", Etiqueta: "Agresion fisica o amenaza"},
}

var emotionLabelsES = map[string]string{
	"indignacion":    "Indignacion",
	"miedo":          "Miedo",
	"tristeza":       "Tristeza",
	"disgusto":       "Disgusto",
	"impotencia":     "Impotencia",
	"esperanza":      "Esperanza",
	"neutralidad":    "Neutralidad",
	"anger":          "Enojo",
	"fear":           "Miedo",
	"sadness":        "Tristeza",
	"disgust":        "Disgusto",
	"joy":            "Alegria",
	"others":         "Otros",
	"neutral":        "Neutral",
	"sin_clasificar": "Sin clasificar",
}

func (h CentroNLPHandler) Process(w http.ResponseWriter, r *http.Request) {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	var req CentroNLPProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	start := h.Jobs.Start(r.Context(), services.NLPRunOptions{
		Limit:      req.Limit,
		EncuestaID: req.EncuestaID,
		CentroIDs:  centros,
		Year:       req.Year,
		DryRun:     req.DryRun,
	})

	statusCode := http.StatusAccepted
	if !start.Started {
		statusCode = http.StatusOK
	}

	writeJSONCentro(w, statusCode, CentroNLPProcessResponse{
		Centros: centros,
		Started: start.Started,
		Status:  start.Status,
	})
}

func (h CentroNLPHandler) Status(w http.ResponseWriter, r *http.Request) {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	year, err := parseOptionalYear(r.URL.Query().Get("year"))
	if err != nil {
		http.Error(w, "bad_year", http.StatusBadRequest)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroNLPStatusResponse{
		Centros: centros,
		Year:    year,
		Status:  h.Jobs.GetStatus(centros, year),
	})
}

func (h CentroNLPHandler) Overview(w http.ResponseWriter, r *http.Request) {
	if UserRolFromCtx(r.Context()) != "centro" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	centros := UserCentrosFromCtx(r.Context())
	if len(centros) == 0 {
		http.Error(w, "no_centros", http.StatusForbidden)
		return
	}

	var year *int
	if raw := r.URL.Query().Get("year"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			http.Error(w, "bad_year", http.StatusBadRequest)
			return
		}
		year = &value
	}

	resp := CentroNLPOverviewResponse{
		Centros:        centros,
		Year:           year,
		PorSentimiento: []CountItem{},
		PorEmocion:     []CountItem{},
		PorTema:        []CountItem{},
		CatalogoTemas:  append([]NLPCatalogItem{}, nlpThemeCatalog...),
	}

	rawSentimientos := []services.NLPCountItem{}
	rawEmociones := []services.NLPCountItem{}
	rawTemas := []services.NLPCountItem{}

	if err := services.FillNLPOverview(
		r.Context(),
		h.Runner.DBURL,
		centros,
		year,
		&resp.TotalComentarios,
		&resp.TotalProcesados,
		&resp.TotalPendientes,
		&resp.TotalError,
		&rawSentimientos,
		&rawEmociones,
		&rawTemas,
	); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	for _, item := range rawSentimientos {
		resp.PorSentimiento = append(resp.PorSentimiento, CountItem(item))
	}
	for _, item := range rawEmociones {
		resp.PorEmocion = append(resp.PorEmocion, CountItem(item))
	}
	for _, item := range rawTemas {
		resp.PorTema = append(resp.PorTema, CountItem(item))
	}

	if resp.TotalComentarios > 0 {
		resp.AvancePorcentaje = (float64(resp.TotalProcesados) / float64(resp.TotalComentarios)) * 100
	}

	for index := range resp.PorEmocion {
		if label, ok := emotionLabelsES[resp.PorEmocion[index].Clave]; ok {
			resp.PorEmocion[index].Label = label
		}
	}

	writeJSONCentro(w, http.StatusOK, resp)
}
