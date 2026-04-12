from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    spacy_model: str = os.getenv("SPACY_MODEL", "es_core_news_md")


settings = Settings()
