/**
 * Normaliza fechas escritas en español (2/12/25, 02-12-2025, etc.) a DD/MM/AAAA e ISO.
 * Año de 2 cifras: 00–99 → 2000–2099.
 */

export function normalizeSpanishDateInput(raw: string): { ddmmyyyy: string; iso: string } | null {
    const t = raw.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
        const iso = t.slice(0, 10);
        const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
        if (!y || !m || !d) return null;
        return {
            ddmmyyyy: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
            iso,
        };
    }
    const s = t.replace(/\./g, "/").replace(/-/g, "/");
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) {
        y = 2000 + y;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const ddmmyyyy = `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
    return { ddmmyyyy, iso };
}

/** Para enviar al API (YYYY-MM-DD). */
export function fechaFlexibleAISO(fecha: string): string {
    if (!fecha?.trim()) return "";
    const n = normalizeSpanishDateInput(fecha);
    if (n) return n.iso;
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.split("T")[0];
    return fecha.trim();
}

/** Para mostrar en formularios DD/MM/AAAA. */
export function fechaFlexibleADDMMYYYY(fecha: string): string {
    if (!fecha?.trim()) return "";
    const n = normalizeSpanishDateInput(fecha);
    if (n) return n.ddmmyyyy;
    return fecha.trim();
}

/** ISO YYYY-MM-DD → DD/MM/YYYY */
export function isoToDisplayDDMM(iso: string): string {
    if (!iso?.trim()) return "";
    const head = iso.split("T")[0];
    const m = head.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return fechaFlexibleADDMMYYYY(iso);
    return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Fecha para tablas/celdas: siempre DD/MM/AAAA con ceros (evita toLocaleDateString 2/2/2025). */
export function formatDateTableES(value: unknown): string {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "number" && value > 0 && value < 100000) {
        const d = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) {
            return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
        }
    }
    const str = String(value).trim();
    if (!str) return "-";
    const isoOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoOnly) {
        return `${isoOnly[3]}/${isoOnly[2]}/${isoOnly[1]}`;
    }
    const n = normalizeSpanishDateInput(str);
    if (n) return n.ddmmyyyy;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
    return str;
}
