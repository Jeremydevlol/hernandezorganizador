/**
 * Custom API route proxy for /api/cuaderno/*
 * Handles long timeouts for AI operations (chat/execute can take minutes).
 * Supports both JSON and multipart/form-data (file uploads).
 */
import { NextRequest, NextResponse } from 'next/server';

/** Node evita límites cortos del Edge en subidas y chat largo. */
export const runtime = 'nodejs';
/** Vercel: subir en dashboard si el plan lo permite (Hobby suele ser 10–60s; Pro hasta 300s+). */
export const maxDuration = 300;

/** Backend Python (Render en prod). En Vercel a veces VERCEL no está en el runtime del Route Handler → antes caíamos en 127.0.0.1 y el proxy devolvía 502. */
function getBackendUrl(): string {
  const explicit = process.env.BACKEND_URL?.trim();
  if (explicit) return explicit;
  const onVercel =
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_ENV ||
    !!process.env.NEXT_PUBLIC_VERCEL_URL;
  if (onVercel) return 'https://hernandezback.onrender.com';
  // next build + next start local (NODE_ENV=production) sin env Vercel: no usar 127.0.0.1 salvo que quieras solo backend local (BACKEND_URL).
  if (process.env.NODE_ENV === 'production') {
    return 'https://hernandezback.onrender.com';
  }
  return 'http://127.0.0.1:8000';
}

const TIMEOUT = 900_000; // 15 minutes (subidas Excel grandes + análisis)

/**
 * GET /api/cuaderno/list (clientes cacheados) → backend /catalog/cuadernos.
 * En algunos despliegues FastAPI hace match de /{cuaderno_id} antes que /list y trata "list" como id → 404.
 */
function mapBackendCuadernoPath(method: string, pathStr: string): string {
  if ((method === 'GET' || method === 'HEAD') && pathStr === 'list') {
    return 'catalog/cuadernos';
  }
  return pathStr;
}

// --- HTTP verb handlers (Next.js App Router) ---

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}

// --- Core proxy logic ---

async function proxy(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const pathStr = mapBackendCuadernoPath(request.method, path.join('/'));
  const qs = request.nextUrl.searchParams.toString();
  const backendUrl = `${getBackendUrl()}/api/cuaderno/${pathStr}${qs ? `?${qs}` : ''}`;

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    let body: BodyInit | undefined;
    const headers: Record<string, string> = {};

    if (hasBody) {
      if (isMultipart) {
        // File uploads: pass raw bytes and preserve the original Content-Type (includes boundary)
        body = await request.arrayBuffer();
        headers['Content-Type'] = contentType;
      } else {
        body = await request.text();
        headers['Content-Type'] = 'application/json';
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // For file downloads (Excel, PDF), stream the response as-is
    const resContentType = res.headers.get('content-type') || '';
    if (resContentType.includes('application/') && !resContentType.includes('json')) {
      const data = await res.arrayBuffer();
      return new NextResponse(data, {
        status: res.status,
        headers: {
          'Content-Type': resContentType,
          'Content-Disposition': res.headers.get('content-disposition') || '',
        },
      });
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { detail: text || 'Respuesta no válida del backend' };
    }

    return NextResponse.json(json, { status: res.status });
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'La operación tardó demasiado. Intenta de nuevo.'
        : err instanceof Error
          ? err.message
          : 'Error desconocido';

    console.error(`[proxy] ${request.method} ${pathStr} →`, msg);

    return NextResponse.json(
      { success: false, mensaje: `❌ ${msg}`, detail: msg },
      { status: 502 },
    );
  }
}
