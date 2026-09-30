/** Unidades de dosis que se pueden elegir al aplicar un producto. */
export const UNIDADES_DOSIS = ["L/Ha", "Kg/Ha", "ml/H", "g/Ha"] as const;

/** Unidades antiguas del desplegable → equivalentes actuales */
export function migrateUnidadDosis(u: string | undefined): string {
    const m: Record<string, string> = { "cc/L": "ml/H", "g/L": "g/Ha" };
    const x = (u || "").trim();
    return m[x] || x || "L/Ha";
}
