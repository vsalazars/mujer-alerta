package handlers

import (
	"context"
	"fmt"
	"net/http"
)

func (h CentroResultadosHandler) GetResumenCentro(w http.ResponseWriter, r *http.Request) {
	centros, ok := h.requireCentros(w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	year, err := parseOptionalYear(r.URL.Query().Get("year"))
	if err != nil {
		http.Error(w, "bad_year", http.StatusBadRequest)
		return
	}

	var totalParticipantes int64
	var totalRespuestas int64

	if err := queryRow(ctx, h.DB, `
		select count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&totalParticipantes); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if err := queryRow(ctx, h.DB, `
		select count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&totalRespuestas); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if totalRespuestas == 0 {
		http.Error(w, "no_data", http.StatusNotFound)
		return
	}

	stats := newCentroStats(totalParticipantes, totalRespuestas)

	if err := queryRow(ctx, h.DB, `
		select
			count(*)::bigint as total_comentarios,
			count(*) filter (where ca.estado = 'procesado')::bigint as total_procesados,
			count(*) filter (where ca.id is null or ca.estado = 'pendiente')::bigint as total_pendientes,
			count(*) filter (where ca.estado = 'error')::bigint as total_error
		from encuestas e
		left join comentario_analisis ca on ca.encuesta_id = e.id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		  and e.comentario is not null
		  and btrim(e.comentario) <> ''
	`, centros, year).Scan(
		&stats.NLP.TotalComentarios,
		&stats.NLP.TotalProcesados,
		&stats.NLP.TotalPendientes,
		&stats.NLP.TotalError,
	); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	var global ResumenGlobal
	rows, err := query(ctx, h.DB, `
		select r.dimension::text, avg(r.valor)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by r.dimension
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var dimension string
		var avg float64
		if err := rows.Scan(&dimension, &avg); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		switch dimension {
		case "frecuencia":
			global.Frecuencia = avg
		case "normalidad":
			global.Normalidad = avg
		case "gravedad":
			global.Gravedad = avg
		}
	}

	if err := queryRow(ctx, h.DB, `
		select avg(r.valor)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
	`, centros, year).Scan(&global.Total); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	preguntasInicialesResumen, err := h.buildPreguntasInicialesResumen(ctx, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	matrizRows, err := query(ctx, h.DB, `
		with mapa as (
			select * from (values
				('P1',1),('P2',1),
				('P3',2),('P4',2),
				('P5',3),('P6',3),
				('P7',4),('P8',4),
				('P9',5),('P10',5),
				('P11',6),('P12',6),
				('P13',7),('P14',7),
				('P15',8),('P16',8)
			) as t(pregunta_id, tipo_num)
		),
		tipos as (
			select * from (values
				(1,'Descalificación / Humillación'),
				(2,'Discriminación por ser mujer'),
				(3,'Sexualización / Comentarios sexuales'),
				(4,'Hostigamiento sexual'),
				(5,'Abuso de poder'),
				(6,'Obstaculización académica o laboral'),
				(7,'Violencia digital / mediática'),
				(8,'Agresión o amenaza')
			) as t(tipo_num, tipo_nombre)
		)
		select
			t.tipo_num,
			t.tipo_nombre,
			r.dimension::text,
			round(avg(r.valor)::numeric,2)::float8
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join mapa m on m.pregunta_id = r.pregunta_id
		join tipos t on t.tipo_num = m.tipo_num
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by t.tipo_num, t.tipo_nombre, r.dimension
		order by t.tipo_num, r.dimension
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer matrizRows.Close()

	matriz := []MatrizItem{}
	for matrizRows.Next() {
		var item MatrizItem
		if err := matrizRows.Scan(&item.TipoNum, &item.TipoNombre, &item.Dimension, &item.Promedio); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		matriz = append(matriz, item)
	}

	generoEncuestasRows, _ := query(ctx, h.DB, `
		select g.clave, g.etiqueta, count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by count(*) desc
	`, centros, year)
	for generoEncuestasRows.Next() {
		var item CountItem
		generoEncuestasRows.Scan(&item.Clave, &item.Label, &item.Total)
		stats.EncuestasPorGenero = append(stats.EncuestasPorGenero, item)
	}
	generoEncuestasRows.Close()

	generoRespuestasRows, _ := query(ctx, h.DB, `
		select g.clave, g.etiqueta, count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by count(*) desc
	`, centros, year)
	for generoRespuestasRows.Next() {
		var item CountItem
		generoRespuestasRows.Scan(&item.Clave, &item.Label, &item.Total)
		stats.RespuestasPorGenero = append(stats.RespuestasPorGenero, item)
	}
	generoRespuestasRows.Close()

	generoResumenRows, err := query(ctx, h.DB, `
		select
			g.clave,
			g.etiqueta,
			coalesce(avg(case when r.dimension = 'frecuencia' then r.valor end), 0)::float8 as frecuencia,
			coalesce(avg(case when r.dimension = 'normalidad' then r.valor end), 0)::float8 as normalidad,
			coalesce(avg(case when r.dimension = 'gravedad' then r.valor end), 0)::float8 as gravedad
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		join generos g on g.id = e.genero_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by g.clave, g.etiqueta
		order by g.etiqueta asc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	for generoResumenRows.Next() {
		var item GeneroDimItem
		if err := generoResumenRows.Scan(&item.Clave, &item.Label, &item.Frecuencia, &item.Normalidad, &item.Gravedad); err != nil {
			generoResumenRows.Close()
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.ResumenPorGenero = append(stats.ResumenPorGenero, item)
	}
	generoResumenRows.Close()

	edadKey := `e.edad::text`

	queryEdadEncuestas := fmt.Sprintf(`
		select %s as clave, %s as label, count(distinct e.id)
		from encuestas e
		join respuestas r on r.encuesta_id = e.id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by 1,2
		order by count(*) desc
	`, edadKey, edadKey)

	edadEncuestasRows, _ := query(ctx, h.DB, queryEdadEncuestas, centros, year)
	for edadEncuestasRows.Next() {
		var item CountItem
		edadEncuestasRows.Scan(&item.Clave, &item.Label, &item.Total)
		stats.EncuestasPorEdad = append(stats.EncuestasPorEdad, item)
	}
	edadEncuestasRows.Close()

	queryEdadRespuestas := fmt.Sprintf(`
		select %s as clave, %s as label, count(*)
		from respuestas r
		join encuestas e on e.id = r.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by 1,2
		order by count(*) desc
	`, edadKey, edadKey)

	edadRespuestasRows, _ := query(ctx, h.DB, queryEdadRespuestas, centros, year)
	for edadRespuestasRows.Next() {
		var item CountItem
		edadRespuestasRows.Scan(&item.Clave, &item.Label, &item.Total)
		stats.RespuestasPorEdad = append(stats.RespuestasPorEdad, item)
	}
	edadRespuestasRows.Close()

	sentimientoRows, err := query(ctx, h.DB, `
		select
			coalesce(sentimiento_label, 'sin_clasificar') as clave,
			coalesce(sentimiento_label, 'Sin clasificar') as label,
			count(*)::bigint as total
		from v_comentario_analisis_resumen
		where centro_id = any($1::bigint[])
		  and ($2::int is null or extract(year from finished_at) = $2)
		group by 1, 2
		order by total desc, label asc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	for sentimientoRows.Next() {
		var item CountItem
		if err := sentimientoRows.Scan(&item.Clave, &item.Label, &item.Total); err != nil {
			sentimientoRows.Close()
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.NLP.PorSentimiento = append(stats.NLP.PorSentimiento, item)
	}
	sentimientoRows.Close()

	emocionRows, err := query(ctx, h.DB, `
		select
			coalesce(emocion_label, 'sin_clasificar') as clave,
			coalesce(emocion_label, 'Sin clasificar') as label,
			count(*)::bigint as total
		from v_comentario_analisis_resumen
		where centro_id = any($1::bigint[])
		  and ($2::int is null or extract(year from finished_at) = $2)
		group by 1, 2
		order by total desc, label asc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	for emocionRows.Next() {
		var item CountItem
		if err := emocionRows.Scan(&item.Clave, &item.Label, &item.Total); err != nil {
			emocionRows.Close()
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.NLP.PorEmocion = append(stats.NLP.PorEmocion, item)
	}
	emocionRows.Close()

	temaRows, err := query(ctx, h.DB, `
		select
			ct.tema_clave,
			ct.tema_etiqueta,
			count(*)::bigint as total
		from comentario_tema ct
		join comentario_analisis ca on ca.id = ct.analisis_id
		join encuestas e on e.id = ca.encuesta_id
		where ct.rank = 1
		  and e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by ct.tema_clave, ct.tema_etiqueta
		order by total desc, ct.tema_etiqueta asc
		limit 8
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	for temaRows.Next() {
		var item CountItem
		if err := temaRows.Scan(&item.Clave, &item.Label, &item.Total); err != nil {
			temaRows.Close()
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		stats.NLP.PorTema = append(stats.NLP.PorTema, item)
	}
	temaRows.Close()

	comentariosRows, err := query(ctx, h.DB, `
		select
			v.encuesta_id::text,
			v.id,
			to_char(v.finished_at, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha,
			coalesce(g.etiqueta, '') as genero,
			coalesce(e.edad, 0) as edad,
			v.comentario,
			coalesce(v.estado, 'sin_procesar') as estado,
			coalesce(v.resumen, '') as resumen,
			coalesce(v.sentimiento_label, 'sin_clasificar') as sentimiento_label,
			coalesce(v.sentimiento_score, 0)::float8 as sentimiento_score,
			coalesce(v.emocion_label, 'sin_clasificar') as emocion_label,
			coalesce(v.emocion_score, 0)::float8 as emocion_score,
			coalesce(v.keywords, '[]'::jsonb) as keywords,
			coalesce(ct.tema_clave, '') as tema_clave,
			coalesce(ct.tema_etiqueta, '') as tema_etiqueta,
			coalesce(ct.score, 0)::float8 as tema_score,
			coalesce(v.confianza_general, 0)::float8 as confianza_general,
			coalesce(v.pipeline_version, '') as pipeline_version
		from v_comentario_analisis_resumen v
		join encuestas e on e.id = v.encuesta_id
		left join generos g on g.id = e.genero_id
		left join comentario_tema ct on ct.analisis_id = v.id and ct.rank = 1
		where v.centro_id = any($1::bigint[])
		  and ($2::int is null or extract(year from v.finished_at) = $2)
		order by v.finished_at desc
	`, centros, year)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer comentariosRows.Close()

	for comentariosRows.Next() {
		var item ComentarioItem
		var keywordsJSON []byte
		if err := comentariosRows.Scan(
			&item.EncuestaID,
			&item.AnalisisID,
			&item.Fecha,
			&item.Genero,
			&item.Edad,
			&item.Texto,
			&item.Estado,
			&item.Resumen,
			&item.SentimientoLabel,
			&item.SentimientoScore,
			&item.EmocionLabel,
			&item.EmocionScore,
			&keywordsJSON,
			&item.TemaClave,
			&item.TemaEtiqueta,
			&item.TemaScore,
			&item.ConfianzaGeneral,
			&item.PipelineVersion,
		); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		item.Keywords = decodeStringArrayJSON(keywordsJSON)
		stats.Comentarios = append(stats.Comentarios, item)
	}
	if err := comentariosRows.Err(); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	writeJSONCentro(w, http.StatusOK, CentroResumenResponse{
		Centros:            centros,
		Global:             global,
		PreguntasIniciales: preguntasInicialesResumen,
		Matriz:             matriz,
		Stats:              stats,
	})
}

func (h CentroResultadosHandler) buildPreguntasInicialesResumen(ctx context.Context, centros []int64, year *int) (PreguntasInicialesDashboardResumen, error) {
	resumen := PreguntasInicialesDashboardResumen{
		SectionID:    h.PreguntasIniciales.SectionID,
		Name:         h.PreguntasIniciales.Name,
		Subtitle:     h.PreguntasIniciales.Subtitle,
		Instructions: h.PreguntasIniciales.Instructions,
		Preguntas:    make([]PreguntaInicialResumen, 0, len(h.PreguntasIniciales.Questions)),
	}

	rows, err := query(ctx, h.DB, `
		select ri.pregunta_id, ri.opcion_id, count(*)::bigint
		from respuestas_iniciales ri
		join encuestas e on e.id = ri.encuesta_id
		where e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by ri.pregunta_id, ri.opcion_id
	`, centros, year)
	if err != nil {
		return resumen, err
	}
	defer rows.Close()

	type optionCount struct {
		total int64
	}

	countsByQuestion := make(map[string]map[string]optionCount, len(h.PreguntasIniciales.Questions))
	for rows.Next() {
		var questionID string
		var optionID string
		var total int64
		if err := rows.Scan(&questionID, &optionID, &total); err != nil {
			return resumen, err
		}
		if _, ok := countsByQuestion[questionID]; !ok {
			countsByQuestion[questionID] = make(map[string]optionCount)
		}
		countsByQuestion[questionID][optionID] = optionCount{total: total}
	}
	if err := rows.Err(); err != nil {
		return resumen, err
	}

	for _, question := range h.PreguntasIniciales.Questions {
		item := PreguntaInicialResumen{
			PreguntaID: question.QuestionID,
			Prompt:     question.Prompt,
			Opciones:   make([]PreguntaInicialOpcionResumen, 0, len(question.Options)),
		}

		for _, option := range question.Options {
			total := countsByQuestion[question.QuestionID][option.OptionID].total
			item.TotalRespuestas += total
			item.Opciones = append(item.Opciones, PreguntaInicialOpcionResumen{
				OpcionID: option.OptionID,
				Label:    option.Label,
				Total:    total,
			})
		}

		for idx := range item.Opciones {
			option := &item.Opciones[idx]
			if item.TotalRespuestas > 0 {
				option.Porcentaje = float64(option.Total) * 100 / float64(item.TotalRespuestas)
			}
			if option.Total > item.OpcionTopTotal {
				item.OpcionTopID = option.OpcionID
				item.OpcionTopLabel = option.Label
				item.OpcionTopTotal = option.Total
				item.OpcionTopPct = option.Porcentaje
			}
		}

		resumen.TotalRespuestas += item.TotalRespuestas
		resumen.Preguntas = append(resumen.Preguntas, item)
	}

	return resumen, nil
}
