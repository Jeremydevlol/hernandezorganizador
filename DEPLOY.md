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

**Root Directory en Vercel (elige una opción):**

1. **Recomendado:** **General → Root Directory** = `excel_sort_bot/cuaderno-ui`. Build por defecto `npm run build` en esa carpeta; Vercel encuentra `.next` ahí sin trucos.

2. **Raíz del repo = `.`:** el repo incluye `vercel.json` con `buildCommand: npm run vercel-build`. Ese script construye en `cuaderno-ui` y crea en la raíz un **symlink** `.next` → `excel_sort_bot/cuaderno-ui/.next` para que el preset de Next.js en Vercel no falle con *“output directory .next was not found at /vercel/path0/.next”*.

**No** uses “Output Directory” en el dashboard apuntando solo a una subcarpeta `.next` sin el preset completo de Next: en el pasado eso publicaba la app como estática y **`/api/cuaderno/*` devolvía 404**. El symlink + `vercel-build` no sustituye el output por una carpeta estática; deja intacto el árbol `.next` del build real.

En Vercel, el proxy usa por defecto `https://hernandezback.onrender.com` (detecta VERCEL=1). Si quieres otro backend, añade `BACKEND_URL` en Environment Variables.

**Nota:** En el plan free de Render, el backend entra en sleep tras inactividad. El primer request puede tardar ~30-60s (cold start). Los siguientes serán rápidos.

## Resumen

```
Usuario → Vercel (Next.js) → /api/cuaderno/* → proxy → hernandezback.onrender.com
```
