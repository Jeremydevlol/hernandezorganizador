/** Parsea dosis/cantidades con coma o punto decimal. */
export function parseDecimalInput(s: string | number | undefined | null): number | null {
    if (s === undefined || s === null) return null;
    if (typeof s === "number") return Number.isFinite(s) ? s : null;
    const t = String(s).trim().replace(",", ".");
    if (t === "" || t === "." || t === "-" || t === "-.") return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
}
