#!/bin/bash
# Abre el Editor en Tiempo Real como APP DE ESCRITORIO (Electron).
# Incluye: Backend (lo arranca Electron) + Next.js + ventana Electron.
# NO incluye la app web "Sube tu Excel desordenado" (excel_sort_frontend).

echo "🚀 Iniciando Editor en Tiempo Real (app de escritorio)..."
echo ""

# Limpiar procesos anteriores
echo "🧹 Limpiando procesos anteriores..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true
pkill -f "rte_server.py" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
CUADERNO_UI_DIR="$BASE_DIR/excel_sort_bot/cuaderno-ui"

cd "$CUADERNO_UI_DIR" || exit 1

# Instalar dependencias si faltan
if [ ! -d "node_modules/tailwindcss" ]; then
  echo "📦 Instalando dependencias..."
  npm install
fi

# Forzar resolución desde cuaderno-ui (evita "Can't resolve tailwindcss in excel_sort_bot")
export NODE_PATH="$CUADERNO_UI_DIR/node_modules"
export NEXT_RESOLVE_ROOT="$CUADERNO_UI_DIR"

npm run desktop
