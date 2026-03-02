#!/bin/bash
echo "🧹 Limpiando procesos antiguos..."
pkill -f "next-server" || true
pkill -f "electron" || true
pkill -f "rte_server.py" || true
pkill -f "node" || true

echo "✨ Iniciando Cuaderno App Desktop..."
cd /Volumes/Uniclick4TB/organizadorhndezbueno/excel_sort_bot/cuaderno-ui

# Limpiar cache de next si existe bloqueo
rm -rf .next/dev/lock

npm run desktop
