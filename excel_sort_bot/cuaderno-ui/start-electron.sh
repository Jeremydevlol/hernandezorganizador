#!/bin/bash
# Ejecuta Electron. Si falla (ej. sin display en terminal de Cursor), abre el navegador.

cd "$(dirname "$0")"

./node_modules/.bin/electron . || {
    echo ""
    echo "🌐 Electron no pudo iniciar. Abriendo app en el navegador..."
    command -v open &>/dev/null && open "http://localhost:3000"
    echo "   → http://localhost:3000"
}
exit 0
