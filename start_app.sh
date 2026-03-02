#!/bin/bash
# Script único para iniciar Backend + App Desktop
# Inicia el backend ANTES de la app para evitar "Internal Server Error" al cargar cuadernos
#
# Ejecutar desde la raíz del proyecto (organizadorhndezbueno):
#   cd /Volumes/Uniclick4TB/organizadorhndezbueno
#   ./start_app.sh

echo "🚀 Iniciando Backend + App Desktop..."
echo ""

# Limpiar procesos anteriores
echo "🧹 Limpiando procesos anteriores..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true
pkill -f "rte_server.py" 2>/dev/null || true
pkill -f "python.*rte_server" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$BASE_DIR/excel_sort_bot"
CUADERNO_UI_DIR="$BASE_DIR/excel_sort_bot/cuaderno-ui"

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Iniciar backend PRIMERO (evita Internal Server Error al cargar cuadernos)
echo "📡 Iniciando backend en puerto 8000..."
cd "$API_DIR"
python3 rte_server.py &
BACKEND_PID=$!
cd - > /dev/null

# Esperar a que el backend esté listo
echo "⏳ Esperando backend..."
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/cuaderno/list 2>/dev/null | grep -q 200; then
    echo "✅ Backend listo"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Backend no respondió a tiempo"
    kill $BACKEND_PID 2>/dev/null
    exit 1
  fi
  sleep 0.5
done

cd "$CUADERNO_UI_DIR" || exit 1

# Instalar dependencias si faltan
if [ ! -d "node_modules/tailwindcss" ]; then
  echo "📦 Instalando dependencias..."
  npm install
fi

# Forzar resolución desde cuaderno-ui
export NODE_PATH="$CUADERNO_UI_DIR/node_modules"
export NEXT_RESOLVE_ROOT="$CUADERNO_UI_DIR"

# Indicar a Electron que NO inicie el backend (ya está corriendo)
export BACKEND_ALREADY_RUNNING=1

echo "✅ Iniciando app desktop..."
echo ""

npm run desktop
