/** Detecta páginas HTML de error (Vercel/Render 502) para no mostrarlas al usuario. */
export function looksLikeHtml(body: string): boolean {
    const t = body.trim().slice(0, 400).toLowerCase();
    return (
        t.startsWith('<!doctype') ||
        t.startsWith('<html') ||
        t.includes('<title>502</title>') ||
        t.includes('<title>503</title>') ||
        (t.includes('<head>') && t.includes('</html>'))
    );
}

export function gatewayUserMessage(status: number): string {
    if (status === 503) {
        return 'El servidor está ocupado. Espera unos segundos y vuelve a intentarlo.';
    }
    return 'El servidor backend no respondió (puede estar arrancando en Render). Espera 30 segundos y vuelve a intentarlo.';
}

/** Convierte cuerpo de error (JSON o HTML) en mensaje legible. */
export function sanitizeApiError(
    rawBody: string,
    status: number,
    parsed?: { mensaje?: string; detail?: unknown } | null,
): string {
    if (status === 502 || status === 503) {
        if (parsed?.mensaje && typeof parsed.mensaje === 'string' && !looksLikeHtml(parsed.mensaje)) {
            return parsed.mensaje.replace(/^❌\s*/, '');
        }
        const detail = parsed?.detail;
        if (typeof detail === 'string' && detail.trim() && !looksLikeHtml(detail)) {
            return detail;
        }
        return gatewayUserMessage(status);
    }
    if (looksLikeHtml(rawBody)) {
        return gatewayUserMessage(status);
    }
    if (parsed?.mensaje && typeof parsed.mensaje === 'string') {
        return parsed.mensaje.replace(/^❌\s*/, '');
    }
    const detail = parsed?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ');
    }
    if (detail != null) return JSON.stringify(detail);
    return rawBody.trim().slice(0, 200) || `HTTP ${status}`;
}
