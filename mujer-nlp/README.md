# Mujer NLP

Base para integrar procesamiento de lenguaje natural de comentarios en `Mujer Alerta`.

## Objetivo inicial

Este módulo está pensado para:

- leer comentarios desde PostgreSQL
- limpiarlos y normalizarlos
- extraer palabras clave
- clasificar temas o tipos de violencia
- calcular señales analíticas para que el backend en Go las exponga al frontend

## Estructura

- `requirements.txt`: dependencias base del entorno Python
- `src/`: código del módulo de análisis

## Instalación

Desde esta carpeta:

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -m spacy download es_core_news_md
```

## Siguiente paso sugerido

Crear un script que:

1. lea comentarios desde la tabla `encuestas`
2. procese solo comentarios no vacíos
3. escriba resultados en una tabla derivada, por ejemplo `comentario_analisis`

## Dependencias elegidas

- `spacy`: NLP base para español
- `scikit-learn`: clasificación y clustering
- `sentence-transformers`: embeddings semánticos
- `keybert`: extracción de keywords
- `sqlalchemy` y `psycopg`: acceso a PostgreSQL
- `pandas` y `numpy`: manipulación de datos
