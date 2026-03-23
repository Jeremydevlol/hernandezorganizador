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

**Importante — Root Directory:** en el proyecto de Vercel, **General → Root Directory** debe ser `excel_sort_bot/cuaderno-ui` (donde está `next.config.ts` y `app/`). Si la raíz del repo es `.`, Vercel no aplica bien el preset de Next.js y las rutas `app/api/*` no se despliegan.

**No** configures un “Output Directory” manual apuntando a `.next`: Vercel lo resuelve solo para Next.js. Forzar `outputDirectory` a `.next` en `vercel.json` hace que la app se publique como estática y **`/api/cuaderno/*` responda 404** aunque la home cargue.

Build: con Root Directory correcto, basta `npm run build` (o el comando por defecto de Next). Si construyes desde la raíz del monorepo sin cambiar Root Directory, usa el script `npm run vercel-build` en la raíz del repo.

En Vercel, el proxy usa por defecto `https://hernandezback.onrender.com` (detecta VERCEL=1). Si quieres otro backend, añade `BACKEND_URL` en Environment Variables.

**Nota:** En el plan free de Render, el backend entra en sleep tras inactividad. El primer request puede tardar ~30-60s (cold start). Los siguientes serán rápidos.

## Resumen

```
Usuario → Vercel (Next.js) → /api/cuaderno/* → proxy → hernandezback.onrender.com
```
