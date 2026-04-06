/** Parsea dosis/cantidades con coma o punto decimal. */
export function parseDecimalInput(s: string | number | undefined | null): number | null {
    if (s === undefined || s === null) return null;
    if (typeof s === "number") return Number.isFinite(s) ? s : null;
    const t = String(s).trim().replace(",", ".");
    if (t === "" || t === "." || t === "-" || t === "-.") return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
}

/** Interpreta celdas de dosis con unidad (p. ej. "1,5 L/Ha", "2 ml/H", "Dosis 3 kg/ha"). */
export function parseTratamientoDosisInput(s: string): { num: number; unit: string } {
    const raw = String(s || "").trim();
    if (!raw) return { num: 0, unit: "L/Ha" };
    const lowerCompact = raw.toLowerCase().replace(/\s/g, "");
    let unit = "L/Ha";
    if (lowerCompact.includes("ml/h")) unit = "ml/H";
    else if (lowerCompact.includes("kg/ha")) unit = "Kg/Ha";
    else if (lowerCompact.includes("g/ha")) unit = "g/Ha";
    else if (lowerCompact.includes("l/ha")) unit = "L/Ha";
    const withoutUnit = raw.replace(/\s*(l\/ha|kg\/ha|ml\/h|g\/ha)\s*$/i, "").trim();
    let num = parseDecimalInput(withoutUnit);
    if (num === null) {
        const m = raw.match(/-?\d+[.,]?\d*/);
        if (m) num = parseDecimalInput(m[0]);
    }
    if (num === null) num = 0;
    return { num, unit };
}
