from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import psycopg
import spacy
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pysentimiento import create_analyzer
from transformers import pipeline as hf_pipeline

from .config import settings


THEMES: tuple[dict[str, str], ...] = (
    {"clave": "tv1_descalificacion_humillacion", "etiqueta": "Descalificacion o humillacion"},
    {"clave": "tv2_discriminacion_por_ser_mujer", "etiqueta": "Discriminacion por ser mujer"},
    {
        "clave": "tv3_sexualizacion_comentarios_sexuales",
        "etiqueta": "Sexualizacion o comentarios sexuales",
    },
    {"clave": "tv4_hostigamiento_sexual", "etiqueta": "Hostigamiento sexual"},
    {"clave": "tv5_abuso_de_poder", "etiqueta": "Abuso de poder o autoridad"},
    {
        "clave": "tv6_obstaculizacion_academica_laboral",
        "etiqueta": "Obstaculizacion academica o laboral",
    },
    {"clave": "tv7_violencia_digital", "etiqueta": "Violencia digital o mediatica"},
    {"clave": "tv8_agresion_o_amenaza", "etiqueta": "Agresion fisica o amenaza"},
)

VIOLENCE_THEMES = {
    "tv1_descalificacion_humillacion",
    "tv2_discriminacion_por_ser_mujer",
    "tv3_sexualizacion_comentarios_sexuales",
    "tv4_hostigamiento_sexual",
    "tv5_abuso_de_poder",
    "tv8_agresion_o_amenaza",
}

EMOTIONS: tuple[dict[str, str], ...] = (
    {"clave": "indignacion", "etiqueta": "indignacion o enojo ante una injusticia"},
    {"clave": "miedo", "etiqueta": "miedo o temor a represalias o consecuencias"},
    {"clave": "tristeza", "etiqueta": "tristeza o dolor emocional"},
    {"clave": "disgusto", "etiqueta": "disgusto o rechazo ante una conducta inaceptable"},
    {"clave": "impotencia", "etiqueta": "impotencia o frustracion por no poder cambiar algo"},
    {"clave": "esperanza", "etiqueta": "esperanza o deseo de mejora y cambio positivo"},
    {"clave": "neutralidad", "etiqueta": "neutralidad o descripcion objetiva sin carga emocional"},
)

THEME_SCORE_THRESHOLD = 0.20
VIOLENCE_OVERRIDE_THRESHOLD = 0.35
EMOTION_SCORE_THRESHOLD = 0.25

_SENTIMENT_LABEL_MAP = {
    "POS": "positivo",
    "NEG": "negativo",
    "NEU": "neutral",
}

STOPWORD_EXTRAS = {
    "ser",
    "estar",
    "haber",
    "tener",
    "hacer",
    "poder",
    "decir",
    "ver",
    "pasar",
    "dejar",
    "poner",
    "dar",
    "asi",
    "solo",
    "cosa",
    "algo",
    "alguien",
    "si",
}

WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class PendingComment:
    encuesta_id: str
    comentario: str
    institucion_id: int


def load_sentiment_analyzer():
    return create_analyzer(task="sentiment", lang="es")


def load_theme_classifier():
    return hf_pipeline(
        "zero-shot-classification",
        model="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli",
        device=-1,
    )


def analyze_sentiment(text: str, analyzer: Any) -> dict[str, Any]:
    result = analyzer.predict(text)
    label = _SENTIMENT_LABEL_MAP.get(result.output, "neutral")
    prob = result.probas.get(result.output, 0.0)

    if label == "negativo":
        score = -round(prob, 5)
    elif label == "positivo":
        score = round(prob, 5)
    else:
        score = 0.0

    return {
        "label": label,
        "score": score,
        "probabilities": {
            "positivo": round(result.probas.get("POS", 0.0), 5),
            "negativo": round(result.probas.get("NEG", 0.0), 5),
            "neutral": round(result.probas.get("NEU", 0.0), 5),
        },
    }


def adjust_sentiment_by_themes(
    sentiment: dict[str, Any],
    themes: list[dict[str, Any]],
) -> dict[str, Any]:
    if sentiment["label"] != "positivo":
        return sentiment

    violence_scores = [
        theme["score"]
        for theme in themes
        if theme["tema_clave"] in VIOLENCE_THEMES
        and theme["score"] >= VIOLENCE_OVERRIDE_THRESHOLD
    ]

    if not violence_scores:
        return sentiment

    forced_score = -round(sum(violence_scores) / len(violence_scores), 5)
    return {
        **sentiment,
        "label": "negativo",
        "score": forced_score,
        "adjusted_by_themes": True,
    }


def analyze_emotion(text: str, classifier: Any) -> dict[str, Any]:
    candidate_labels = [emotion["etiqueta"] for emotion in EMOTIONS]
    etiqueta_to_clave = {emotion["etiqueta"]: emotion["clave"] for emotion in EMOTIONS}

    output = classifier(
        text,
        candidate_labels=candidate_labels,
        multi_label=False,
        hypothesis_template="La persona que escribio esto siente {}.",
    )

    top_label = output["labels"][0]
    top_score = output["scores"][0]
    top_clave = etiqueta_to_clave[top_label]

    if top_score < EMOTION_SCORE_THRESHOLD:
        top_clave = "neutralidad"
        top_label = "neutralidad o descripcion objetiva sin carga emocional"

    probabilities = {
        etiqueta_to_clave[label]: round(score, 5)
        for label, score in zip(output["labels"], output["scores"])
    }

    return {
        "label": top_clave,
        "score": round(top_score, 5),
        "probabilities": probabilities,
    }


def infer_themes(text: str, classifier: Any, max_themes: int) -> list[dict[str, Any]]:
    candidate_labels = [theme["etiqueta"] for theme in THEMES]
    etiqueta_to_clave = {theme["etiqueta"]: theme["clave"] for theme in THEMES}

    output = classifier(
        text,
        candidate_labels=candidate_labels,
        multi_label=True,
        hypothesis_template="Este texto habla de {}.",
    )

    ranked: list[dict[str, Any]] = []
    rank = 1
    for label, score in zip(output["labels"], output["scores"]):
        if score < THEME_SCORE_THRESHOLD:
            continue
        ranked.append(
            {
                "tema_clave": etiqueta_to_clave[label],
                "tema_etiqueta": label,
                "score": round(score, 5),
                "rank": rank,
                "origen": "zero-shot",
            }
        )
        rank += 1
        if rank > max_themes:
            break

    return ranked


def normalize_text(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip()


def summarize_text(doc: Any, fallback: str, max_chars: int = 280) -> str:
    first_sentence = next(iter(doc.sents), None)
    if first_sentence is None:
        return fallback[:max_chars].strip()
    text = first_sentence.text.strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "..."


def extract_entities(doc: Any) -> list[dict[str, Any]]:
    return [
        {"text": ent.text, "label": ent.label_, "start": ent.start_char, "end": ent.end_char}
        for ent in doc.ents
    ]


def extract_keywords(doc: Any, max_keywords: int) -> list[str]:
    phrases: list[str] = []
    seen: set[str] = set()

    for chunk in getattr(doc, "noun_chunks", []):
        value = normalize_text(chunk.text.lower())
        if len(value) < 4 or value in seen:
            continue
        seen.add(value)
        phrases.append(value)
        if len(phrases) >= max_keywords:
            return phrases

    counts: Counter[str] = Counter()
    for token in doc:
        if token.is_stop or token.is_punct or token.is_space or token.like_num:
            continue
        lemma = normalize_text(token.lemma_.lower())
        if len(lemma) < 4 or lemma in STOPWORD_EXTRAS:
            continue
        if token.pos_ not in {"NOUN", "PROPN", "ADJ", "VERB"}:
            continue
        counts[lemma] += 1

    for lemma, _ in counts.most_common(max_keywords * 2):
        if lemma in seen:
            continue
        phrases.append(lemma)
        if len(phrases) >= max_keywords:
            break

    return phrases[:max_keywords]


def process_comment(
    nlp: Any,
    pending: PendingComment,
    sentiment_analyzer: Any,
    theme_classifier: Any,
) -> dict[str, Any]:
    normalized_text = normalize_text(pending.comentario)
    doc = nlp(normalized_text)

    keywords = extract_keywords(doc, settings.max_keywords)
    entities = extract_entities(doc)
    themes = infer_themes(normalized_text, theme_classifier, settings.max_themes)
    sentiment = analyze_sentiment(normalized_text, sentiment_analyzer)
    sentiment = adjust_sentiment_by_themes(sentiment, themes)
    emotion = analyze_emotion(normalized_text, theme_classifier)

    return {
        "normalized_text": normalized_text,
        "summary": summarize_text(doc, normalized_text),
        "keywords": keywords,
        "entities": entities,
        "themes": themes,
        "sentiment": sentiment,
        "emotion": emotion,
        "token_count": sum(1 for token in doc if not token.is_space),
        "char_count": len(normalized_text),
    }


def fetch_pending_comments(
    conn: psycopg.Connection[Any],
    limit: int | None,
    encuesta_id: str | None,
    centro_ids: list[int] | None,
    year: int | None,
) -> list[PendingComment]:
    filters: list[str] = []
    params: list[Any] = []

    if encuesta_id:
        filters.append("e.id::text = %s")
        params.append(encuesta_id)
    if centro_ids:
        filters.append("e.centro_id = any(%s)")
        params.append(centro_ids)
    if year is not None:
        filters.append("extract(year from e.finished_at) = %s")
        params.append(year)

    base_filters = [
        "e.finished_at is not null",
        "e.comentario is not null",
        "btrim(e.comentario) <> ''",
        "(ca.id is null or ca.estado <> 'procesado' or ca.emocion_label is null)",
    ]
    all_filters = filters + base_filters
    where_clause = "where " + " and ".join(all_filters)
    sql = f"""
        select
            e.id::text as encuesta_id,
            e.comentario,
            e.institucion_id
        from public.encuestas e
        left join public.comentario_analisis ca
            on ca.encuesta_id = e.id
        {where_clause}
        order by e.finished_at desc nulls last, e.created_at desc
    """
    if limit is not None:
        sql += " limit %s"
        params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        PendingComment(
            encuesta_id=str(row["encuesta_id"]),
            comentario=row["comentario"],
            institucion_id=int(row["institucion_id"]),
        )
        for row in rows
    ]


def save_success(
    conn: psycopg.Connection[Any],
    pending: PendingComment,
    normalized_text: str,
    summary: str,
    keywords: list[str],
    entities: list[dict[str, Any]],
    themes: list[dict[str, Any]],
    sentiment: dict[str, Any],
    emotion: dict[str, Any],
    token_count: int,
    char_count: int,
) -> None:
    now = datetime.now(timezone.utc)
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.comentario_analisis (
                    encuesta_id, institucion_id, estado, pipeline_version, spacy_model, idioma,
                    texto_normalizado, resumen, keywords, entidades,
                    sentimiento_label, sentimiento_score,
                    emocion_label, emocion_score, emociones,
                    tokens_count, caracteres_count, confianza_general,
                    error_detalle, analizado_at, updated_at
                )
                values (%s, %s, 'procesado', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, null, %s, %s)
                on conflict (encuesta_id) do update
                set institucion_id    = excluded.institucion_id,
                    estado            = excluded.estado,
                    pipeline_version  = excluded.pipeline_version,
                    spacy_model       = excluded.spacy_model,
                    idioma            = excluded.idioma,
                    texto_normalizado = excluded.texto_normalizado,
                    resumen           = excluded.resumen,
                    keywords          = excluded.keywords,
                    entidades         = excluded.entidades,
                    sentimiento_label = excluded.sentimiento_label,
                    sentimiento_score = excluded.sentimiento_score,
                    emocion_label     = excluded.emocion_label,
                    emocion_score     = excluded.emocion_score,
                    emociones         = excluded.emociones,
                    tokens_count      = excluded.tokens_count,
                    caracteres_count  = excluded.caracteres_count,
                    confianza_general = excluded.confianza_general,
                    error_detalle     = null,
                    analizado_at      = excluded.analizado_at,
                    updated_at        = excluded.updated_at
                returning id
                """,
                (
                    pending.encuesta_id,
                    pending.institucion_id,
                    settings.pipeline_version,
                    settings.spacy_model,
                    settings.default_language,
                    normalized_text,
                    summary,
                    Jsonb(keywords),
                    Jsonb(entities),
                    sentiment["label"],
                    sentiment["score"],
                    emotion["label"],
                    emotion["score"],
                    Jsonb(emotion["probabilities"]),
                    token_count,
                    char_count,
                    round(max((theme["score"] for theme in themes), default=0.0), 5),
                    now,
                    now,
                ),
            )
            analisis_id = cur.fetchone()[0]

            cur.execute("delete from public.comentario_tema where analisis_id = %s", (analisis_id,))
            for theme in themes:
                cur.execute(
                    """
                    insert into public.comentario_tema
                        (analisis_id, tema_clave, tema_etiqueta, score, rank, origen)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        analisis_id,
                        theme["tema_clave"],
                        theme["tema_etiqueta"],
                        theme["score"],
                        theme["rank"],
                        theme["origen"],
                    ),
                )


def save_error(conn: psycopg.Connection[Any], pending: PendingComment, error_message: str) -> None:
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.comentario_analisis
                    (encuesta_id, institucion_id, estado, pipeline_version, spacy_model, idioma, error_detalle, updated_at)
                values (%s, %s, 'error', %s, %s, %s, %s, now())
                on conflict (encuesta_id) do update
                set institucion_id   = excluded.institucion_id,
                    estado           = excluded.estado,
                    pipeline_version = excluded.pipeline_version,
                    spacy_model      = excluded.spacy_model,
                    idioma           = excluded.idioma,
                    error_detalle    = excluded.error_detalle,
                    updated_at       = excluded.updated_at
                """,
                (
                    pending.encuesta_id,
                    pending.institucion_id,
                    settings.pipeline_version,
                    settings.spacy_model,
                    settings.default_language,
                    error_message[:2000],
                ),
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Procesa comentarios pendientes de Mujer Alerta.")
    parser.add_argument("--limit", type=int, default=100, help="Maximo de comentarios a procesar.")
    parser.add_argument("--encuesta-id", dest="encuesta_id", help="Procesa una encuesta especifica.")
    parser.add_argument(
        "--centro-id",
        dest="centro_ids",
        type=int,
        action="append",
        help="Filtra por centro_id (repetible).",
    )
    parser.add_argument("--year", type=int, help="Filtra por año de finalizacion.")
    parser.add_argument("--dry-run", action="store_true", help="Sin escribir en BD.")
    parser.add_argument(
        "--job-id",
        dest="job_id",
        help="Identificador de nlp_jobs para persistir el avance desde Cloud Run.",
    )
    parser.add_argument(
        "--json-progress",
        action="store_true",
        help="Emite progreso como JSON Lines.",
    )
    return parser.parse_args()


def emit_event(json_progress: bool, payload: dict[str, Any], text: str | None = None) -> None:
    if json_progress:
        print(json.dumps(payload, ensure_ascii=True), flush=True)
    elif text:
        print(text, flush=True)


def mark_job_phase(
    conn: psycopg.Connection[Any] | None,
    job_id: str | None,
    phase: str,
) -> None:
    if conn is None or not job_id:
        return

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                update public.nlp_jobs
                set status = 'running',
                    running = true,
                    last_event = %s,
                    started_at = coalesce(started_at, now()),
                    updated_at = now()
                where id = %s::uuid
                  and running = true
                """,
                (phase, job_id),
            )
    except Exception as exc:
        print(f"No se pudo guardar fase NLP: {type(exc).__name__}: {exc}", file=sys.stderr)


def persist_job_event(
    conn: psycopg.Connection[Any] | None,
    job_id: str | None,
    payload: dict[str, Any],
) -> None:
    if conn is None or not job_id:
        return

    event = str(payload.get("event") or "")
    current = int(payload.get("current") or 0)
    total = int(payload.get("total") or 0)
    processed = int(payload.get("processed") or 0)
    errors = int(payload.get("errors") or 0)
    status = str(payload.get("status") or "")
    encuesta_id = str(payload.get("encuesta_id") or "")
    error = str(payload.get("error") or "")

    try:
        with conn.cursor() as cur:
            if event == "start":
                cur.execute(
                    """
                    update public.nlp_jobs
                    set status = 'running',
                        running = true,
                        total_value = greatest(total_value, %s),
                        last_event = 'start',
                        started_at = coalesce(started_at, now()),
                        updated_at = now()
                    where id = %s::uuid
                      and running = true
                    """,
                    (total, job_id),
                )
            elif event == "progress":
                processed_increment = 1 if status in {"processed", "dry-run"} else 0
                error_increment = 1 if status == "error" else 0
                cur.execute(
                    """
                    update public.nlp_jobs
                    set status = 'running',
                        running = true,
                        current_value = greatest(current_value, %s),
                        total_value = greatest(total_value, %s),
                        processed_value = processed_value + %s,
                        errors_value = errors_value + %s,
                        last_encuesta_id = case
                            when nullif(%s, '') is null then last_encuesta_id
                            else %s::uuid
                        end,
                        last_event = 'progress',
                        last_error = case
                            when nullif(%s, '') is null then last_error
                            else %s
                        end,
                        updated_at = now()
                    where id = %s::uuid
                      and running = true
                    """,
                    (
                        current,
                        total,
                        processed_increment,
                        error_increment,
                        encuesta_id,
                        encuesta_id,
                        error,
                        error,
                        job_id,
                    ),
                )
            elif event == "complete":
                cur.execute(
                    """
                    update public.nlp_jobs
                    set status = 'completed',
                        running = false,
                        current_value = greatest(current_value, %s),
                        total_value = greatest(total_value, %s),
                        processed_value = greatest(processed_value, %s),
                        errors_value = greatest(errors_value, %s),
                        last_event = 'complete',
                        finished_at = now(),
                        updated_at = now()
                    where id = %s::uuid
                    """,
                    (total, total, processed, errors, job_id),
                )
    except Exception as exc:
        print(f"No se pudo guardar progreso NLP: {type(exc).__name__}: {exc}", file=sys.stderr)


def report_event(
    json_progress: bool,
    payload: dict[str, Any],
    progress_conn: psycopg.Connection[Any] | None,
    job_id: str | None,
    text: str | None = None,
) -> None:
    persist_job_event(progress_conn, job_id, payload)
    emit_event(json_progress, payload, text)


def load_models() -> tuple[Any, Any, Any]:
    print("Cargando modelos NLP...", flush=True, file=sys.stderr)
    nlp = spacy.load(settings.spacy_model)
    sentiment_analyzer = load_sentiment_analyzer()
    theme_classifier = load_theme_classifier()
    print("Modelos listos.", flush=True, file=sys.stderr)
    return nlp, sentiment_analyzer, theme_classifier


def open_progress_connection(job_id: str | None) -> psycopg.Connection[Any] | None:
    if not job_id:
        return None

    try:
        return psycopg.connect(settings.database_url, autocommit=True)
    except Exception as exc:
        print(
            f"No se pudo abrir conexión de progreso NLP: {type(exc).__name__}: {exc}",
            flush=True,
            file=sys.stderr,
        )
        return None


def mark_job_failed(job_id: str | None, error: Exception) -> None:
    if not job_id or not settings.database_url:
        return

    message = f"{type(error).__name__}: {error}"[:2000]
    try:
        with psycopg.connect(settings.database_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update public.nlp_jobs
                    set status = 'failed',
                        running = false,
                        last_event = 'failed',
                        last_error = %s,
                        finished_at = now(),
                        updated_at = now()
                    where id = %s::uuid
                      and running = true
                    """,
                    (message, job_id),
                )
    except Exception as exc:
        print(
            f"No se pudo marcar error NLP: {type(exc).__name__}: {exc}",
            flush=True,
            file=sys.stderr,
        )


def run_analysis(
    args: argparse.Namespace,
    nlp: Any,
    sentiment_analyzer: Any,
    theme_classifier: Any,
    progress_conn: psycopg.Connection[Any] | None = None,
) -> dict[str, int]:
    if not settings.database_url:
        raise SystemExit("Falta DATABASE_URL en el entorno.")

    owns_progress_connection = progress_conn is None
    if progress_conn is None:
        progress_conn = open_progress_connection(args.job_id)

    mark_job_phase(progress_conn, args.job_id, "fetching-comments")

    try:
        with psycopg.connect(settings.database_url, autocommit=False) as conn:
            pending_comments = fetch_pending_comments(
                conn, args.limit, args.encuesta_id, args.centro_ids, args.year
            )
            if not pending_comments:
                result = {"total": 0, "processed": 0, "errors": 0}
                report_event(
                    args.json_progress,
                    {"event": "complete", **result},
                    progress_conn,
                    args.job_id,
                    "No hay comentarios pendientes.",
                )
                return result

            total = len(pending_comments)
            report_event(
                args.json_progress,
                {"event": "start", "total": total},
                progress_conn,
                args.job_id,
                f"Comentarios pendientes: {total}",
            )

            processed = 0
            errors = 0

            for index, pending in enumerate(pending_comments, start=1):
                try:
                    result = process_comment(
                        nlp,
                        pending,
                        sentiment_analyzer,
                        theme_classifier,
                    )

                    if args.dry_run:
                        payload = {
                            "event": "progress",
                            "current": index,
                            "total": total,
                            "encuesta_id": pending.encuesta_id,
                            "status": "dry-run",
                            "summary": result["summary"],
                            "keywords": result["keywords"],
                            "themes": [
                                theme["tema_clave"] for theme in result["themes"]
                            ],
                            "sentiment": result["sentiment"]["label"],
                            "sentiment_score": result["sentiment"]["score"],
                            "sentiment_probs": result["sentiment"]["probabilities"],
                            "emotion": result["emotion"]["label"],
                            "emotion_score": result["emotion"]["score"],
                            "emotion_probs": result["emotion"]["probabilities"],
                            "adjusted_by_themes": result["sentiment"].get(
                                "adjusted_by_themes",
                                False,
                            ),
                        }
                        report_event(
                            args.json_progress,
                            payload,
                            progress_conn,
                            args.job_id,
                        )
                        if not args.json_progress:
                            sentiment = result["sentiment"]
                            emotion = result["emotion"]
                            print(f"\nencuesta_id     = {pending.encuesta_id}")
                            print(f"resumen         = {result['summary'][:90]}")
                            print(
                                "temas           = "
                                f"{[t['tema_clave'] for t in result['themes']]}"
                            )
                            print(
                                "sentimiento     = "
                                f"{sentiment['label']:10}  "
                                f"score={sentiment['score']:+.3f}"
                            )
                            print(
                                "emocion         = "
                                f"{emotion['label']:15}  "
                                f"score={emotion['score']:.3f}"
                            )
                            print(f"emotion_probs   = {emotion['probabilities']}")
                            print(
                                "adjusted        = "
                                f"{sentiment.get('adjusted_by_themes', False)}"
                            )
                    else:
                        save_success(
                            conn,
                            pending,
                            result["normalized_text"],
                            result["summary"],
                            result["keywords"],
                            result["entities"],
                            result["themes"],
                            result["sentiment"],
                            result["emotion"],
                            result["token_count"],
                            result["char_count"],
                        )
                        report_event(
                            args.json_progress,
                            {
                                "event": "progress",
                                "current": index,
                                "total": total,
                                "encuesta_id": pending.encuesta_id,
                                "status": "processed",
                            },
                            progress_conn,
                            args.job_id,
                        )
                    processed += 1

                except Exception as exc:
                    errors += 1
                    message = f"{type(exc).__name__}: {exc}"
                    report_event(
                        args.json_progress,
                        {
                            "event": "progress",
                            "current": index,
                            "total": total,
                            "encuesta_id": pending.encuesta_id,
                            "status": "error",
                            "error": message,
                        },
                        progress_conn,
                        args.job_id,
                    )
                    if not args.json_progress:
                        print(f"[error] encuesta_id={pending.encuesta_id} {message}")
                    if not args.dry_run:
                        save_error(conn, pending, message)

            result = {
                "total": total,
                "processed": processed,
                "errors": errors,
            }
            report_event(
                args.json_progress,
                {"event": "complete", **result},
                progress_conn,
                args.job_id,
            )
            if not args.json_progress:
                print(f"\nProcesados: {processed}  Errores: {errors}")
            sys.stdout.flush()
            return result
    finally:
        if owns_progress_connection and progress_conn is not None:
            progress_conn.close()


def main() -> None:
    args = parse_args()
    progress_conn = open_progress_connection(args.job_id)
    mark_job_phase(progress_conn, args.job_id, "loading-models")

    try:
        models = load_models()
        run_analysis(args, *models, progress_conn=progress_conn)
    except Exception as exc:
        mark_job_failed(args.job_id, exc)
        raise
    finally:
        if progress_conn is not None:
            progress_conn.close()


if __name__ == "__main__":
    main()
