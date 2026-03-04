#!/bin/bash
# Inicia Backend (rte_server.py) + App Desktop (Next.js + Electron)
cd "$(dirname "$0")"

echo "🚀 Iniciando Backend + App Desktop..."
echo ""

cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $DESKTOP_PID 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Limpiar procesos anteriores (por nombre y por puerto)
echo "🧹 Limpiando procesos anteriores..."
pkill -f "rte_server.py" 2>/dev/null
pkill -f "next dev" 2>/dev/null
# Liberar puertos 8000 y 3000 por si quedaron procesos colgados
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2

# Iniciar backend
echo "📡 Iniciando backend en puerto 8000..."
cd excel_sort_bot
python3 rte_server.py &
BACKEND_PID=$!
cd ..

# Esperar a que el backend esté listo
echo "⏳ Esperando backend..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/api/cuaderno/list > /dev/null 2>&1; then
        echo "✅ Backend listo"
        break
    fi
    sleep 1
done

# Iniciar app desktop (Next.js + Electron)
# BACKEND_ALREADY_RUNNING=1 evita que Electron intente arrancar otro backend (puerto 8000 ya en uso)
echo "✅ Iniciando app desktop..."
cd excel_sort_bot/cuaderno-ui
BACKEND_ALREADY_RUNNING=1 npm run desktop &
DESKTOP_PID=$!
cd ../..

# Esperar a que termine
wait
