package services

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type NLPCountItem struct {
	Clave string
	Label string
	Total int64
}

func FillNLPOverview(
	ctx context.Context,
	dbURL string,
	centros []int64,
	year *int,
	totalComentarios *int64,
	totalProcesados *int64,
	totalPendientes *int64,
	totalError *int64,
	porSentimiento *[]NLPCountItem,
	porEmocion *[]NLPCountItem,
	porTema *[]NLPCountItem,
) error {
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := pool.QueryRow(ctx, `
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
	`, centros, year).Scan(totalComentarios, totalProcesados, totalPendientes, totalError); err != nil {
		return err
	}

	sentRows, err := pool.Query(ctx, `
		select
			coalesce(sentimiento_label, 'sin_clasificar') as clave,
			coalesce(sentimiento_label, 'Sin clasificar') as label,
			count(*)::bigint as total
		from v_comentario_analisis_resumen
		where centro_id = any($1::bigint[])
		  and estado = 'procesado'
		  and ($2::int is null or extract(year from finished_at) = $2)
		group by 1, 2
		order by total desc, label asc
	`, centros, year)
	if err != nil {
		return err
	}
	for sentRows.Next() {
		var item NLPCountItem
		if err := sentRows.Scan(&item.Clave, &item.Label, &item.Total); err != nil {
			sentRows.Close()
			return err
		}
		*porSentimiento = append(*porSentimiento, item)
	}
	sentRows.Close()

	emRows, err := pool.Query(ctx, `
		select
			coalesce(emocion_label, 'sin_clasificar') as clave,
			coalesce(emocion_label, 'Sin clasificar') as label,
			count(*)::bigint as total
		from v_comentario_analisis_resumen
		where centro_id = any($1::bigint[])
		  and estado = 'procesado'
		  and ($2::int is null or extract(year from finished_at) = $2)
		group by 1, 2
		order by total desc, label asc
	`, centros, year)
	if err != nil {
		return err
	}
	for emRows.Next() {
		var item NLPCountItem
		if err := emRows.Scan(&item.Clave, &item.Label, &item.Total); err != nil {
			emRows.Close()
			return err
		}
		*porEmocion = append(*porEmocion, item)
	}
	emRows.Close()

	themeCounts := map[string]int64{}
	topicRows, err := pool.Query(ctx, `
		select
			ct.tema_clave,
			count(*)::bigint as total
		from comentario_tema ct
		join comentario_analisis ca on ca.id = ct.analisis_id
		join encuestas e on e.id = ca.encuesta_id
		where ct.rank = 1
		  and e.centro_id = any($1::bigint[])
		  and e.finished_at is not null
		  and ($2::int is null or extract(year from e.finished_at) = $2)
		group by ct.tema_clave
	`, centros, year)
	if err != nil {
		return err
	}
	for topicRows.Next() {
		var clave string
		var total int64
		if err := topicRows.Scan(&clave, &total); err != nil {
			topicRows.Close()
			return err
		}
		themeCounts[clave] = total
	}
	topicRows.Close()

	catalog := []NLPCountItem{
		{Clave: "tv1_descalificacion_humillacion", Label: "Descalificacion o humillacion"},
		{Clave: "tv2_discriminacion_por_ser_mujer", Label: "Discriminacion por ser mujer"},
		{Clave: "tv3_sexualizacion_comentarios_sexuales", Label: "Sexualizacion o comentarios sexuales"},
		{Clave: "tv4_hostigamiento_sexual", Label: "Hostigamiento sexual"},
		{Clave: "tv5_abuso_de_poder", Label: "Abuso de poder o autoridad"},
		{Clave: "tv6_obstaculizacion_academica_laboral", Label: "Obstaculizacion academica o laboral"},
		{Clave: "tv7_violencia_digital", Label: "Violencia digital o mediatica"},
		{Clave: "tv8_agresion_o_amenaza", Label: "Agresion fisica o amenaza"},
	}
	for _, item := range catalog {
		item.Total = themeCounts[item.Clave]
		*porTema = append(*porTema, item)
	}

	return nil
}
