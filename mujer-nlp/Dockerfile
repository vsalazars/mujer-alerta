FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/opt/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1 \
    SPACY_MODEL=es_core_news_md \
    DEFAULT_LANGUAGE=es \
    PIPELINE_VERSION=nlp-v1 \
    MAX_KEYWORDS=8 \
    MAX_THEMES=3

WORKDIR /app

RUN python -m pip install --upgrade \
        pip \
        setuptools \
        wheel \
    && python -m pip install \
        --index-url https://download.pytorch.org/whl/cpu \
        torch==2.11.0

COPY requirements.txt ./

RUN python -m pip install --requirement requirements.txt \
    && python -m pip check

# Los pesos quedan dentro de la imagen para evitar descargarlos en cada ejecución.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='pysentimiento/robertuito-sentiment-analysis'); snapshot_download(repo_id='MoritzLaurer/mDeBERTa-v3-base-mnli-xnli')"

COPY src ./src

ENTRYPOINT ["python", "-m", "src.analyze_comments"]
CMD ["--json-progress"]
