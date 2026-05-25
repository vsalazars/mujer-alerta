package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"mujer-back/services"
)

type CentroResultadosHandler struct {
	DB                 *pgxpool.Pool
	PreguntasIniciales services.PreguntasInicialesDefinition
}

type CountItem struct {
	Clave string `json:"clave"`
	Label string `json:"label"`
	Total int64  `json:"total"`
}

type GeneroDimItem struct {
	Clave      string  `json:"clave"`
	Label      string  `json:"label"`
	Frecuencia float64 `json:"frecuencia"`
	Normalidad float64 `json:"normalidad"`
	Gravedad   float64 `json:"gravedad"`
}

type ComentarioItem struct {
	EncuestaID       string   `json:"encuesta_id"`
	AnalisisID       int64    `json:"analisis_id"`
	Fecha            string   `json:"fecha"`
	Genero           string   `json:"genero"`
	Edad             int      `json:"edad"`
	Texto            string   `json:"texto"`
	Estado           string   `json:"estado"`
	Resumen          string   `json:"resumen"`
	SentimientoLabel string   `json:"sentimiento_label"`
	SentimientoScore float64  `json:"sentimiento_score"`
	EmocionLabel     string   `json:"emocion_label"`
	EmocionScore     float64  `json:"emocion_score"`
	Keywords         []string `json:"keywords"`
	TemaClave        string   `json:"tema_clave"`
	TemaEtiqueta     string   `json:"tema_etiqueta"`
	TemaScore        float64  `json:"tema_score"`
	ConfianzaGeneral float64  `json:"confianza_general"`
	PipelineVersion  string   `json:"pipeline_version"`
}

type NLPStats struct {
	TotalComentarios int64       `json:"total_comentarios"`
	TotalProcesados  int64       `json:"total_procesados"`
	TotalPendientes  int64       `json:"total_pendientes"`
	TotalError       int64       `json:"total_error"`
	PorSentimiento   []CountItem `json:"por_sentimiento"`
	PorEmocion       []CountItem `json:"por_emocion"`
	PorTema          []CountItem `json:"por_tema"`
}

type CentroStats struct {
	TotalParticipantes  int64            `json:"total_participantes"`
	TotalEncuestas      int64            `json:"total_encuestas"`
	TotalRespuestas     int64            `json:"total_respuestas"`
	EncuestasPorGenero  []CountItem      `json:"encuestas_por_genero"`
	RespuestasPorGenero []CountItem      `json:"respuestas_por_genero"`
	EncuestasPorEdad    []CountItem      `json:"encuestas_por_edad"`
	RespuestasPorEdad   []CountItem      `json:"respuestas_por_edad"`
	ResumenPorGenero    []GeneroDimItem  `json:"resumen_por_genero"`
	Comentarios         []ComentarioItem `json:"comentarios"`
	NLP                 NLPStats         `json:"nlp"`
}

type PreguntaInicialOpcionResumen struct {
	OpcionID   string  `json:"opcion_id"`
	Label      string  `json:"label"`
	Total      int64   `json:"total"`
	Porcentaje float64 `json:"porcentaje"`
}

type PreguntaInicialResumen struct {
	PreguntaID      string                         `json:"pregunta_id"`
	Prompt          string                         `json:"prompt"`
	TotalRespuestas int64                          `json:"total_respuestas"`
	OpcionTopID     string                         `json:"opcion_top_id"`
	OpcionTopLabel  string                         `json:"opcion_top_label"`
	OpcionTopTotal  int64                          `json:"opcion_top_total"`
	OpcionTopPct    float64                        `json:"opcion_top_pct"`
	Opciones        []PreguntaInicialOpcionResumen `json:"opciones"`
}

type PreguntasInicialesDashboardResumen struct {
	SectionID       string                   `json:"section_id"`
	Name            string                   `json:"name"`
	Subtitle        string                   `json:"subtitle"`
	Instructions    string                   `json:"instructions"`
	TotalRespuestas int64                    `json:"total_respuestas"`
	Preguntas       []PreguntaInicialResumen `json:"preguntas"`
}

type CentroResumenResponse struct {
	Centros            []int64                            `json:"centros"`
	Global             ResumenGlobal                      `json:"global"`
	PreguntasIniciales PreguntasInicialesDashboardResumen `json:"preguntas_iniciales"`
	Matriz             []MatrizItem                       `json:"matriz"`
	Stats              CentroStats                        `json:"stats"`
}

type CentroYearsResponse struct {
	Years []int `json:"years"`
}

type CentroAnualPoint struct {
	Year       int     `json:"year"`
	Frecuencia float64 `json:"frecuencia"`
	Normalidad float64 `json:"normalidad"`
	Gravedad   float64 `json:"gravedad"`
	Total      float64 `json:"total"`
	Encuestas  int64   `json:"encuestas"`
	Respuestas int64   `json:"respuestas"`
}

type CentroResumenAnualResponse struct {
	Centros []int64            `json:"centros"`
	Series  []CentroAnualPoint `json:"series"`
}

type EstadisticaDimension struct {
	Dimension string `json:"dimension"`

	NRespuestas     int64 `json:"n_respuestas"`
	NEncuestas      int64 `json:"n_encuestas"`
	TotalRespuestas int64 `json:"total_respuestas"`
	KItems          int64 `json:"k_items"`

	Promedio float64 `json:"promedio"`
	StdDev   float64 `json:"std_dev"`

	Mediana float64 `json:"mediana"`
	P25     float64 `json:"p25"`
	P75     float64 `json:"p75"`

	IC95Inferior float64 `json:"ic95_inferior"`
	IC95Superior float64 `json:"ic95_superior"`

	StdDevEncuestas       float64 `json:"std_dev_encuestas"`
	IC95InferiorEncuestas float64 `json:"ic95_inferior_encuestas"`
	IC95SuperiorEncuestas float64 `json:"ic95_superior_encuestas"`

	AlphaCronbach float64 `json:"alpha_cronbach"`
}

type CentroEstadisticaAvanzadaResponse struct {
	Centros []int64                `json:"centros"`
	Year    int                    `json:"year"`
	Datos   []EstadisticaDimension `json:"datos"`
}
