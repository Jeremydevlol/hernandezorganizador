# Guía de despliegue en producción

La aplicación tiene **dos partes**:

1. **Frontend** (Next.js) → Vercel
2. **Backend** (Python FastAPI) → Render: https://hernandezback.onrender.com

## Backend en Render

El backend está desplegado en **https://hernandezback.onrender.com** (mismo repo).

El `render.yaml` en la raíz del repo define el servicio. Al conectar el repo a Render, usa:
- Root: `excel_sort_bot`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn rte_server:app --host 0.0.0.0 --port $PORT`

Variables de entorno en Render: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `STORAGE_MODE=supabase`

## Frontend en Vercel

**Obligatorio — Root Directory:** en **Settings → General → Root Directory** pon **`excel_sort_bot/cuaderno-ui`** (donde están `next.config.ts`, `app/` y `package.json` del Cuaderno). Deja el **Build Command** por defecto (`npm run build` / detección Next) y **sin** “Output Directory” personalizado.

No despliegues este frontend con la raíz del monorepo en `.`: el build genera `.next` dentro de `cuaderno-ui` y el preset de Vercel espera `node_modules/next` y `.next` en la **misma** carpeta. Un symlink de `.next` en la raíz provoca errores como *`.next` not found* o `ENOENT ... node_modules/next/dist/.../middleware-webpack.js`.

Si el proyecto ya está enlazado con Root = `.`, cámbialo a `excel_sort_bot/cuaderno-ui` y vuelve a desplegar (o crea un proyecto nuevo apuntando a esa carpeta).

En Vercel, el proxy usa por defecto `https://hernandezback.onrender.com` (detecta VERCEL=1). Si quieres otro backend, añade `BACKEND_URL` en Environment Variables.

**Nota:** En el plan free de Render, el backend entra en sleep tras inactividad. El primer request puede tardar ~30-60s (cold start). Los siguientes serán rápidos.

## Resumen

```
Usuario → Vercel (Next.js) → /api/cuaderno/* → proxy → hernandezback.onrender.com
```
