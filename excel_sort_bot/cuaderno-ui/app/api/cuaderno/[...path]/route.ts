/**
 * Custom API route proxy for /api/cuaderno/*
 * Handles long timeouts for AI operations (chat/execute can take minutes).
 * Supports both JSON and multipart/form-data (file uploads).
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const TIMEOUT = 300_000; // 5 minutes

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
  const pathStr = path.join('/');
  const qs = request.nextUrl.searchParams.toString();
  const backendUrl = `${BACKEND_URL}/api/cuaderno/${pathStr}${qs ? `?${qs}` : ''}`;

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
