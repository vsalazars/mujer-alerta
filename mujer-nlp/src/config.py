from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    spacy_model: str = os.getenv("SPACY_MODEL", "es_core_news_md")
    default_language: str = os.getenv("DEFAULT_LANGUAGE", "es")
    pipeline_version: str = os.getenv("PIPELINE_VERSION", "nlp-v1")
    max_keywords: int = int(os.getenv("MAX_KEYWORDS", "8"))
    max_themes: int = int(os.getenv("MAX_THEMES", "3"))


settings = Settings()
