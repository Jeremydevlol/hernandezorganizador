#!/bin/bash
# Script para iniciar el Hernandez Bueno Sort Bot (API + Frontend)

echo "🚀 Iniciando Hernandez Bueno Sort Bot..."
echo ""

# Directorio base
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$BASE_DIR/excel_sort_bot"
FRONTEND_DIR="$BASE_DIR/excel_sort_frontend"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $API_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar API
echo -e "${GREEN}📡 Iniciando API en puerto 8000...${NC}"
cd "$API_DIR"
python3 -m uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!

# Esperar a que la API esté lista
sleep 2

# Iniciar Frontend
echo -e "${BLUE}🌐 Iniciando Frontend en puerto 3000...${NC}"
cd "$FRONTEND_DIR"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

echo ""
echo "============================================="
echo -e "${GREEN}✅ Hernandez Bueno Sort Bot está corriendo!${NC}"
echo "============================================="
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "📡 API:       http://localhost:8000"
echo "📖 API Docs:  http://localhost:8000/docs"
echo ""
echo "Presiona Ctrl+C para detener"
echo ""

# Abrir el navegador automáticamente
if command -v open &> /dev/null; then
    sleep 1
    open "http://localhost:3000"
fi

# Esperar
wait
