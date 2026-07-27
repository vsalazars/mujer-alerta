from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from .analyze_comments import load_models, mark_job_failed, run_analysis


MAX_REQUEST_BYTES = 64 * 1024


def parse_payload(payload: Any) -> argparse.Namespace:
    if not isinstance(payload, dict):
        raise ValueError("El cuerpo debe ser un objeto JSON.")

    job_id = str(payload.get("job_id") or "").strip()
    try:
        uuid.UUID(job_id)
    except (ValueError, AttributeError) as exc:
        raise ValueError("job_id inválido.") from exc

    raw_limit = payload.get("limit")
    limit = 100 if raw_limit is None else int(raw_limit)
    if limit < 1 or limit > 1000:
        raise ValueError("limit debe estar entre 1 y 1000.")

    encuesta_id = str(payload.get("encuesta_id") or "").strip()
    if encuesta_id:
        try:
            uuid.UUID(encuesta_id)
        except ValueError as exc:
            raise ValueError("encuesta_id inválido.") from exc

    raw_centro_ids = payload.get("centro_ids")
    if not isinstance(raw_centro_ids, list) or not raw_centro_ids:
        raise ValueError("centro_ids debe contener al menos un centro.")

    centro_ids = sorted({int(value) for value in raw_centro_ids})
    if any(value <= 0 for value in centro_ids):
        raise ValueError("centro_ids contiene un identificador inválido.")

    raw_year = payload.get("year")
    year = None if raw_year is None else int(raw_year)
    if year is not None and (year < 2000 or year > 2100):
        raise ValueError("year fuera de rango.")

    return argparse.Namespace(
        job_id=job_id,
        limit=limit,
        encuesta_id=encuesta_id or None,
        centro_ids=centro_ids,
        year=year,
        dry_run=bool(payload.get("dry_run", False)),
        json_progress=True,
    )


class NLPHTTPServer(HTTPServer):
    models: tuple[Any, Any, Any]


class NLPRequestHandler(BaseHTTPRequestHandler):
    server: NLPHTTPServer

    def do_GET(self) -> None:
        if self.path not in {"/", "/health"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        self.send_json(HTTPStatus.OK, {"status": "ok"})

    def do_POST(self) -> None:
        if self.path != "/process":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_length = self.headers.get("Content-Length")
        try:
            request_size = int(content_length or "0")
        except ValueError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "content_length_invalid"})
            return

        if request_size <= 0 or request_size > MAX_REQUEST_BYTES:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "request_size_invalid"})
            return

        try:
            payload = json.loads(self.rfile.read(request_size))
            args = parse_payload(payload)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError, TypeError) as exc:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "invalid_request", "message": str(exc)},
            )
            return

        started_at = time.monotonic()
        try:
            result = run_analysis(args, *self.server.models)
        except Exception as exc:
            mark_job_failed(args.job_id, exc)
            print(
                f"Error procesando tarea NLP {args.job_id}: "
                f"{type(exc).__name__}: {exc}",
                flush=True,
                file=sys.stderr,
            )
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "nlp_processing_failed"},
            )
            return

        self.send_json(
            HTTPStatus.OK,
            {
                "status": "completed",
                "duration_ms": round((time.monotonic() - started_at) * 1000),
                **result,
            },
        )

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format_string: str, *args: Any) -> None:
        print(
            "%s - %s" % (self.address_string(), format_string % args),
            flush=True,
            file=sys.stderr,
        )


def main() -> None:
    port = int(os.getenv("PORT", "8080"))
    models = load_models()
    server = NLPHTTPServer(("0.0.0.0", port), NLPRequestHandler)
    server.models = models
    print(f"Servicio NLP listo en el puerto {port}.", flush=True, file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
