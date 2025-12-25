#!/usr/bin/env bash
set -e

echo "🚀 Subiendo cambios al repositorio…"

# 1️⃣ Verificar que estamos en un repo git
if [ ! -d ".git" ]; then
  echo "❌ No estás en un repositorio git"
  exit 1
fi

# 2️⃣ Mostrar estado
echo "📄 Estado actual:"
git status --short

# 3️⃣ Agregar todos los cambios
echo "➕ Agregando cambios…"
git add .

# 4️⃣ Mensaje automático con fecha
MSG=${1:-"chore: dashboard premium genero $(date '+%Y-%m-%d %H:%M')"}
echo "📝 Commit: $MSG"
git commit -m "$MSG"

# 5️⃣ Asegurar branch
BRANCH=$(git branch --show-current)
echo "🌿 Branch actual: $BRANCH"

# 6️⃣ Pull con rebase (evita commits basura)
echo "🔄 Sincronizando con remoto…"
git pull --rebase origin "$BRANCH"

# 7️⃣ Push
echo "⬆️  Enviando al remoto…"
git push origin "$BRANCH"

echo "✅ Listo. Cambios subidos correctamente."
