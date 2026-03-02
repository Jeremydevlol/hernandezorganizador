"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Plus,
    FileText,
    FileSpreadsheet,
    LayoutGrid,
    FlaskConical,
    ClipboardList,
    BarChart3,
    Sprout,
    Wheat,
    Eye,
    Trash2,
    Table,
    Copy,
    Pencil,
    ArrowLeft,
    RefreshCw,
    Search,
    ChevronUp,
    ChevronDown,
    X,
    Filter,
    CheckSquare,
    Square,
    History,
    MapPin,
    Table2,
    Send
} from "lucide-react";
import { Cuaderno, SheetType, SHEET_CONFIG, HistoricoRow, HojaExcel, CellSelection } from "@/lib/types";
import { api } from "@/lib/api";
import AddRowModal from "./modals/AddRowModal";
import ImportedSheet from "./ImportedSheet";

// Tipo extendido para incluir hojas importadas
type ExtendedSheetType = SheetType | `imported_${number}`;

export interface EditorActions {
    openSearch: (query?: string) => void;
    replacePreview: (from: string, to: string) => number;
    replaceApply: (from: string, to: string) => Promise<void>;
}

interface EditorProps {
    cuaderno: Cuaderno;
    activeSheet: SheetType;
    onSheetChange: (sheet: SheetType) => void;
    onRefresh: () => void;
    highlight?: { sheet: SheetType; id: string } | null;
    /** Al hacer clic en "Ver" en una fila, resaltarla (scroll + highlight) */
    onRequestHighlight?: (sheet: SheetType, id: string) => void;
    /** Hoja en modo focus (seleccionada desde chat). null = edición global. */
    focusSheetId?: string | null;
    /** Salir del modo focus (volver al cuaderno completo). */
    onFocusModeExit?: () => void;
    /** Ref para que el padre (p. ej. Chat) invoque buscar/reemplazar. */
    editorActionsRef?: React.MutableRefObject<EditorActions | null>;
    /** Callback para enviar selección de celdas al chat */
    onSendSelectionToChat?: (selection: CellSelection) => void;
}

const SHEET_ICONS: Record<SheetType, React.ReactNode> = {
    parcelas: <LayoutGrid size={14} />,
    productos: <FlaskConical size={14} />,
    tratamientos: <ClipboardList size={14} />,
    fertilizantes: <Sprout size={14} />,
    cosecha: <Wheat size={14} />,
    historico: <BarChart3 size={14} />,
};

const BASE_EDITABLE_SHEETS: SheetType[] = ["parcelas", "productos", "tratamientos"];

const BASE_SHEET_IDS: SheetType[] = ["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha", "historico"];
type ParcelSortMode = "num_orden" | "cultivo_superficie";

export default function Editor({ cuaderno, activeSheet, onSheetChange, onRefresh, highlight, onRequestHighlight, focusSheetId = null, onFocusModeExit, editorActionsRef, onSendSelectionToChat }: EditorProps) {
    const [historico, setHistorico] = useState<HistoricoRow[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeImportedSheet, setActiveImportedSheet] = useState<number | null>(null);
    const [editTratamientoId, setEditTratamientoId] = useState<string | null>(null);
    const [historicoFilters, setHistoricoFilters] = useState<{ parcela_id?: string; date_from?: string; date_to?: string; product_id?: string; num_lote?: string }>({});
    const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchActiveIndex, setSearchActiveIndex] = useState(0);
    // ---- Nuevas funcionalidades ----
    const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set());
    const [cultivoFilter, setCultivoFilter] = useState<string>("");
    const [parcelSortMode, setParcelSortMode] = useState<ParcelSortMode>("num_orden");
    const [targetHectareas, setTargetHectareas] = useState<string>("");
    const [showTratamientosParcelaId, setShowTratamientosParcelaId] = useState<string | null>(null);
    const [showTratamientoDetalleId, setShowTratamientoDetalleId] = useState<string | null>(null);
    const [parcelaTratamientos, setParcelaTratamientos] = useState<any[]>([]);
    const [loadingTratamientos, setLoadingTratamientos] = useState(false);
    const [openTreatFromSelection, setOpenTreatFromSelection] = useState(false);
    // ---- Selección de celdas para Chat ----
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // "rowIdx:colKey"
    const [selectionAnchor, setSelectionAnchor] = useState<{ rowIdx: number; colIdx: number } | null>(null);
    const [bulkEditValue, setBulkEditValue] = useState("");
    const [bulkApplying, setBulkApplying] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    const hojas = cuaderno.hojas_originales || [];
    const isFocusMode = focusSheetId != null;
    const focusIsBase = focusSheetId != null && BASE_SHEET_IDS.includes(focusSheetId as SheetType);
    const focusImportedIdx = focusSheetId != null ? (hojas.findIndex((h) => h.sheet_id === focusSheetId) ?? -1) : -1;
    const effectiveSheet = isFocusMode && focusIsBase ? (focusSheetId as SheetType) : activeSheet;
    const effectiveImportedIndex = isFocusMode && focusImportedIdx >= 0 ? focusImportedIdx : activeImportedSheet;

    const config = SHEET_CONFIG[effectiveSheet];
    const focusSheetNombre = isFocusMode
        ? focusIsBase
            ? SHEET_CONFIG[focusSheetId as SheetType]?.title ?? focusSheetId
            : hojas[focusImportedIdx]?.nombre ?? "Hoja importada"
        : "";

    useEffect(() => {
        if (effectiveSheet === "historico") {
            loadHistorico();
        }
    }, [effectiveSheet, cuaderno.id, historicoFilters.parcela_id, historicoFilters.date_from, historicoFilters.date_to, historicoFilters.product_id, historicoFilters.num_lote]);

    const loadHistorico = async () => {
        try {
            const data = await api.getHistorico(cuaderno.id, historicoFilters);
            setHistorico(data.historico || []);
        } catch (error) {
            console.error("Error loading historico:", error);
        }
    };

    const getData = () => {
        switch (effectiveSheet) {
            case "parcelas":
                return cuaderno.parcelas || [];
            case "productos":
                return cuaderno.productos || [];
            case "tratamientos":
                return (cuaderno.tratamientos || []).map(t => ({
                    ...t,
                    parcela_nombres: t.parcela_nombres?.join(", ") || "",
                    productos_display: t.productos?.map(p => p.nombre_comercial).join(", ") || "",
                    dosis_display: t.productos?.map(p => `${p.dosis} ${p.unidad_dosis}`).join(", ") || "",
                }));
            case "fertilizantes":
                return cuaderno.fertilizaciones || [];
            case "cosecha":
                return cuaderno.cosechas || [];
            case "historico":
                return historico;
            default:
                return [];
        }
    };

    const data = getData();

    // ---- Cultivos únicos para filtro ----
    const uniqueCultivos = useMemo(() => {
        if (effectiveSheet !== "parcelas") return [];
        const parcelas = cuaderno.parcelas || [];
        const cultivos = [...new Set(parcelas.map(p => p.especie || p.cultivo).filter(Boolean))];
        return cultivos.sort();
    }, [effectiveSheet, cuaderno.parcelas]);

    // ---- Data filtrada por cultivo ----
    const displayData = useMemo(() => {
        if (effectiveSheet !== "parcelas") return data;
        const filtered = (data as any[]).filter((row: any) => {
            if (!cultivoFilter) return true;
            const cultivo = row.especie || row.cultivo || "";
            return cultivo.toLowerCase().includes(cultivoFilter.toLowerCase());
        });

        const sorted = [...filtered].sort((a: any, b: any) => {
            const aOrden = Number(a.num_orden || 0);
            const bOrden = Number(b.num_orden || 0);
            const aCultivo = String(a.especie || a.cultivo || "").toLowerCase();
            const bCultivo = String(b.especie || b.cultivo || "").toLowerCase();
            const aSup = Number(a.superficie_cultivada || a.superficie_ha || a.superficie_sigpac || 0);
            const bSup = Number(b.superficie_cultivada || b.superficie_ha || b.superficie_sigpac || 0);

            if (parcelSortMode === "cultivo_superficie") {
                if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es");
                if (bSup !== aSup) return bSup - aSup;
                return aOrden - bOrden;
            }
            if (aOrden !== bOrden) return aOrden - bOrden;
            if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es");
            return bSup - aSup;
        });
        return sorted;
    }, [data, effectiveSheet, cultivoFilter, parcelSortMode]);

    // ---- Sumatorio de hectáreas ----
    const hectareasSummary = useMemo(() => {
        if (effectiveSheet !== "parcelas") return null;
        const parcelas = displayData as any[];
        const parseHa = (p: any) => parseFloat(p.superficie_cultivada || p.superficie_ha || p.superficie_sigpac || 0) || 0;
        const totalHa = parcelas.reduce((sum: number, p: any) => sum + parseHa(p), 0);
        const selectedArr = parcelas.filter((p: any) => selectedParcelas.has(p.id));
        const selectedHa = selectedArr.reduce((sum: number, p: any) => sum + parseHa(p), 0);
        return {
            total: parcelas.length,
            totalHa: totalHa,
            selected: selectedArr.length,
            selectedHa: selectedHa,
        };
    }, [effectiveSheet, displayData, selectedParcelas]);

    // Toggle selección parcela
    const toggleParcelaSelection = useCallback((id: string) => {
        setSelectedParcelas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedParcelas(prev => {
            const allIds = (displayData as any[]).map((r: any) => r.id).filter(Boolean);
            if (prev.size === allIds.length) return new Set();
            return new Set(allIds);
        });
    }, [displayData]);

    const autoSelectByHectareas = useCallback(() => {
        const target = parseFloat(targetHectareas || "0");
        if (!target || target <= 0) {
            setSelectedParcelas(new Set());
            return;
        }
        const parcelas = displayData as any[];
        const candidatas = parcelas
            .map((p: any) => ({
                id: p.id as string,
                ha: Number(p.superficie_cultivada || p.superficie_ha || p.superficie_sigpac || 0) || 0,
            }))
            .filter((p: any) => p.id && p.ha > 0);

        if (candidatas.length === 0) {
            setSelectedParcelas(new Set());
            return;
        }

        const pickBetter = (current: { sum: number; count: number }, candidate: { sum: number; count: number }) => {
            const cDiff = Math.abs(current.sum - target);
            const nDiff = Math.abs(candidate.sum - target);
            if (nDiff !== cDiff) return nDiff < cDiff;
            const currentCumple = current.sum >= target;
            const candidateCumple = candidate.sum >= target;
            if (currentCumple !== candidateCumple) return candidateCumple;
            return candidate.count < current.count;
        };

        // 1) Buscar mejor prefijo sobre el orden visible (cultivo/superficie o Nº orden)
        let running = 0;
        let bestEnd = -1;
        let bestMeta = { sum: 0, count: 0 };
        for (let i = 0; i < candidatas.length; i++) {
            running += candidatas[i].ha;
            const meta = { sum: running, count: i + 1 };
            if (bestEnd === -1 || pickBetter(bestMeta, meta)) {
                bestEnd = i;
                bestMeta = meta;
            }
        }

        let selectedIdx = new Set<number>();
        for (let i = 0; i <= bestEnd; i++) selectedIdx.add(i);
        let selectedSum = bestMeta.sum;

        // 2) Refinamiento: intentar reemplazo 1x1 para acercar más al objetivo
        let improved = true;
        while (improved) {
            improved = false;
            let bestSwap: { i: number; j: number; newSum: number } | null = null;
            const currentDiff = Math.abs(selectedSum - target);
            for (const i of selectedIdx) {
                for (let j = 0; j < candidatas.length; j++) {
                    if (selectedIdx.has(j)) continue;
                    const newSum = selectedSum - candidatas[i].ha + candidatas[j].ha;
                    const newDiff = Math.abs(newSum - target);
                    if (newDiff < currentDiff) {
                        if (!bestSwap || newDiff < Math.abs(bestSwap.newSum - target)) {
                            bestSwap = { i, j, newSum };
                        }
                    }
                }
            }
            if (bestSwap) {
                selectedIdx.delete(bestSwap.i);
                selectedIdx.add(bestSwap.j);
                selectedSum = bestSwap.newSum;
                improved = true;
            }
        }

        const seleccion = new Set<string>();
        for (const idx of selectedIdx) {
            seleccion.add(candidatas[idx].id);
        }
        setSelectedParcelas(seleccion);
    }, [displayData, targetHectareas]);

    const applyBulkEditToSelection = useCallback(async () => {
        if (selectedCells.size === 0) return;
        if (!BASE_EDITABLE_SHEETS.includes(effectiveSheet)) {
            alert("La edición masiva solo está disponible en Parcelas, Productos y Tratamientos.");
            return;
        }

        const dataToUse = effectiveSheet === "parcelas" ? (displayData as any[]) : (data as any[]);
        setBulkApplying(true);
        setSaving(true);
        try {
            const updates = Array.from(selectedCells).map((key) => {
                const [rStr, colKey] = key.split(":");
                const rowIndex = parseInt(rStr, 10);
                const row = dataToUse[rowIndex];
                const colCfg = config.columns.find((c) => c.key === colKey);
                return {
                    rowId: row?.id,
                    colKey,
                    editable: colCfg?.editable !== false,
                };
            }).filter((u) => u.rowId && u.colKey && u.editable);

            for (const u of updates) {
                await api.patchCell(cuaderno.id, {
                    sheet_id: effectiveSheet,
                    row: u.rowId,
                    column: u.colKey,
                    value: bulkEditValue,
                });
            }
            setLastSavedAt(Date.now());
            onRefresh();
            setSelectedCells(new Set());
            setSelectionAnchor(null);
            setBulkEditValue("");
        } catch (e) {
            console.error("Error en edición masiva:", e);
            alert("No se pudo aplicar la edición masiva.");
        } finally {
            setBulkApplying(false);
            setSaving(false);
        }
    }, [selectedCells, effectiveSheet, displayData, data, config.columns, cuaderno.id, bulkEditValue, onRefresh]);

    // ---- Cargar tratamientos de una parcela ----
    const loadParcelaTratamientos = useCallback(async (parcelaId: string) => {
        setShowTratamientosParcelaId(parcelaId);
        setLoadingTratamientos(true);
        try {
            const result = await api.getHistoricoParcela(cuaderno.id, parcelaId);
            setParcelaTratamientos(result.tratamientos || []);
        } catch (e) {
            console.error(e);
            setParcelaTratamientos([]);
        } finally {
            setLoadingTratamientos(false);
        }
    }, [cuaderno.id]);

    // ---- Selección de celdas ----
    const handleCellClick = useCallback((rowIdx: number, colIdx: number, e: React.MouseEvent) => {
        // Solo activar con Ctrl/Cmd o Shift
        const key = `${rowIdx}:${config.columns[colIdx]?.key || colIdx}`;

        if (e.shiftKey && selectionAnchor) {
            // Shift+click: seleccionar rango
            const minRow = Math.min(selectionAnchor.rowIdx, rowIdx);
            const maxRow = Math.max(selectionAnchor.rowIdx, rowIdx);
            const minCol = Math.min(selectionAnchor.colIdx, colIdx);
            const maxCol = Math.max(selectionAnchor.colIdx, colIdx);
            const newSet = new Set<string>(selectedCells);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    newSet.add(`${r}:${config.columns[c]?.key || c}`);
                }
            }
            setSelectedCells(newSet);
        } else if (e.metaKey || e.ctrlKey) {
            // Ctrl/Cmd+click: toggle individual
            setSelectedCells(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
            });
            setSelectionAnchor({ rowIdx, colIdx });
        } else {
            // Click normal: seleccionar solo esta celda (nuevo inicio)
            setSelectedCells(new Set([key]));
            setSelectionAnchor({ rowIdx, colIdx });
        }
    }, [config.columns, selectionAnchor, selectedCells]);

    // Seleccionar columna completa
    const handleSelectColumn = useCallback((colIdx: number) => {
        const newSet = new Set<string>();
        const dataToUse = effectiveSheet === "parcelas" ? displayData : data;
        for (let r = 0; r < dataToUse.length; r++) {
            newSet.add(`${r}:${config.columns[colIdx]?.key || colIdx}`);
        }
        setSelectedCells(newSet);
        setSelectionAnchor({ rowIdx: 0, colIdx });
    }, [config.columns, displayData, data, effectiveSheet]);

    // Seleccionar fila completa
    const handleSelectRow = useCallback((rowIdx: number) => {
        const newSet = new Set<string>(selectedCells);
        for (let c = 0; c < config.columns.length; c++) {
            newSet.add(`${rowIdx}:${config.columns[c]?.key || c}`);
        }
        setSelectedCells(newSet);
        setSelectionAnchor({ rowIdx, colIdx: 0 });
    }, [config.columns, selectedCells]);

    const clearCellSelection = useCallback(() => {
        setSelectedCells(new Set());
        setSelectionAnchor(null);
    }, []);

    // Construir CellSelection para el chat
    const buildCellSelection = useCallback((): CellSelection | null => {
        if (selectedCells.size === 0) return null;
        const dataToUse = effectiveSheet === "parcelas" ? displayData : data;
        const configCols = config.columns;
        const sheetName = effectiveImportedIndex !== null
            ? (hojas[effectiveImportedIndex]?.nombre || "Hoja importada")
            : (SHEET_CONFIG[effectiveSheet]?.title ?? effectiveSheet);

        // Agrupar por filas
        const rowMap = new Map<number, Set<string>>();
        for (const key of selectedCells) {
            const [rStr, colKey] = key.split(":");
            const r = parseInt(rStr);
            if (!rowMap.has(r)) rowMap.set(r, new Set());
            rowMap.get(r)!.add(colKey);
        }

        const rows = Array.from(rowMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([rowIdx, colKeys]) => {
                const row = dataToUse[rowIdx] as any;
                if (!row) return null;
                const cells = Array.from(colKeys).map(colKey => {
                    const col = configCols.find(c => c.key === colKey);
                    return {
                        colKey,
                        colLabel: col?.label || colKey,
                        value: row[colKey] ?? "",
                    };
                });
                return {
                    rowId: row.id || String(rowIdx),
                    rowIndex: rowIdx,
                    cells,
                };
            })
            .filter(Boolean) as CellSelection["rows"];

        return {
            sheetId: effectiveImportedIndex !== null
                ? hojas[effectiveImportedIndex].sheet_id
                : effectiveSheet,
            sheetName,
            rows,
        };
    }, [selectedCells, displayData, data, config.columns, effectiveSheet, effectiveImportedIndex, hojas]);

    const handleSendToChat = useCallback(() => {
        const sel = buildCellSelection();
        if (sel && onSendSelectionToChat) {
            onSendSelectionToChat(sel);
            clearCellSelection();
        }
    }, [buildCellSelection, onSendSelectionToChat, clearCellSelection]);

    const sendParcelaCheckboxesToChat = useCallback(() => {
        if (!onSendSelectionToChat || selectedParcelas.size === 0) return;
        const parcelas = (displayData as any[]).filter((p: any) => selectedParcelas.has(p.id));
        const keyCols = ["nombre", "num_orden", "especie", "superficie_cultivada", "superficie_ha"];
        const colLabels: Record<string, string> = {
            nombre: "Nombre", num_orden: "Nº Orden", especie: "Cultivo",
            superficie_cultivada: "Sup. Cultivada", superficie_ha: "Superficie (ha)",
        };
        const sel: CellSelection = {
            sheetId: "parcelas",
            sheetName: SHEET_CONFIG.parcelas.title,
            rows: parcelas.map((p: any, idx: number) => ({
                rowId: p.id,
                rowIndex: idx,
                cells: keyCols
                    .filter((k) => p[k] !== undefined && p[k] !== null && p[k] !== "")
                    .map((k) => ({
                        colKey: k,
                        colLabel: colLabels[k] || k,
                        value: p[k],
                    })),
            })),
        };
        onSendSelectionToChat(sel);
    }, [onSendSelectionToChat, selectedParcelas, displayData]);

    // Limpiar selección al cambiar de hoja
    useEffect(() => {
        clearCellSelection();
    }, [effectiveSheet, effectiveImportedIndex, clearCellSelection]);

    const formatCellValue = useCallback((value: any, type?: string) => {
        if (value === null || value === undefined) return "-";
        if (type === "date" && value) {
            try {
                return new Date(value).toLocaleDateString("es-ES");
            } catch {
                return value;
            }
        }
        if (Array.isArray(value)) return value.join(", ");
        return String(value);
    }, []);

    type SearchMatch = { rowIndex: number; colKey: string | number };
    const searchResults = useMemo((): SearchMatch[] => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        const matches: SearchMatch[] = [];
        if (effectiveImportedIndex !== null && hojas[effectiveImportedIndex]) {
            const hoja = hojas[effectiveImportedIndex];
            const datos = hoja.datos || [];
            for (let ri = 0; ri < datos.length; ri++) {
                const row = datos[ri] || [];
                for (let ci = 0; ci < Math.max(row.length, hoja.columnas?.length || 0); ci++) {
                    const val = row[ci];
                    const str = String(val ?? "").toLowerCase();
                    if (str.includes(q)) matches.push({ rowIndex: ri, colKey: ci });
                }
            }
        } else {
            for (let ri = 0; ri < data.length; ri++) {
                const row = data[ri] as Record<string, unknown>;
                for (const col of config.columns) {
                    const val = row[col.key];
                    const str = formatCellValue(val, col.type).toLowerCase();
                    if (str.includes(q)) matches.push({ rowIndex: ri, colKey: col.key });
                }
            }
        }
        return matches;
    }, [searchQuery, data, config.columns, effectiveImportedIndex, hojas, formatCellValue]);

    const searchActive = searchResults[searchActiveIndex] ?? null;

    useEffect(() => {
        if (searchResults.length > 0 && searchActiveIndex >= searchResults.length) {
            setSearchActiveIndex(searchResults.length - 1);
        }
    }, [searchResults.length, searchActiveIndex]);

    useEffect(() => {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchActiveIndex(0);
    }, [effectiveSheet, effectiveImportedIndex]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "f") {
                e.preventDefault();
                setSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        if (!searchActive) return;
        const el = document.querySelector(`[data-search-row="${searchActive.rowIndex}"][data-search-col="${searchActive.colKey}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [searchActive, searchActiveIndex]);

    const goSearchPrev = useCallback(() => {
        if (searchResults.length === 0) return;
        setSearchActiveIndex((i) => (i <= 0 ? searchResults.length - 1 : i - 1));
    }, [searchResults.length]);

    const goSearchNext = useCallback(() => {
        if (searchResults.length === 0) return;
        setSearchActiveIndex((i) => (i >= searchResults.length - 1 ? 0 : i + 1));
    }, [searchResults.length]);

    const openSearch = useCallback((query?: string) => {
        setSearchOpen(true);
        setSearchQuery(query ?? "");
        setSearchActiveIndex(0);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);

    type ReplaceMatch = { rowIndex: number; colKey: string | number; oldValue: string };
    const getReplaceMatches = useCallback((from: string): ReplaceMatch[] => {
        if (!from.trim()) return [];
        const q = from.trim().toLowerCase();
        const matches: ReplaceMatch[] = [];
        if (effectiveImportedIndex !== null && hojas[effectiveImportedIndex]) {
            const hoja = hojas[effectiveImportedIndex];
            const datos = hoja.datos || [];
            for (let ri = 0; ri < datos.length; ri++) {
                const row = datos[ri] || [];
                for (let ci = 0; ci < Math.max(row.length, hoja.columnas?.length || 0); ci++) {
                    const val = row[ci];
                    const str = String(val ?? "").toLowerCase();
                    if (str.includes(q)) matches.push({ rowIndex: ri, colKey: ci, oldValue: String(val ?? "") });
                }
            }
        } else {
            for (let ri = 0; ri < data.length; ri++) {
                const row = data[ri] as Record<string, unknown>;
                for (const col of config.columns) {
                    const val = row[col.key];
                    const str = formatCellValue(val, col.type).toLowerCase();
                    if (str.includes(q)) matches.push({ rowIndex: ri, colKey: col.key, oldValue: formatCellValue(val, col.type) });
                }
            }
        }
        return matches;
    }, [data, config.columns, effectiveImportedIndex, hojas, formatCellValue]);

    const replacePreview = useCallback((from: string, _to: string) => getReplaceMatches(from).length, [getReplaceMatches]);

    const replaceApply = useCallback(async (from: string, to: string) => {
        const matches = getReplaceMatches(from);
        if (matches.length === 0) return;
        const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");
        const toEscaped = to.replace(/\$/g, "$$");
        setSaving(true);
        try {
            const sheetId = effectiveImportedIndex !== null ? hojas[effectiveImportedIndex].sheet_id : effectiveSheet;
            for (const m of matches) {
                const newValue = m.oldValue.replace(regex, toEscaped);
                if (effectiveImportedIndex !== null) {
                    await api.patchCell(cuaderno.id, { sheet_id: sheetId, row: m.rowIndex, column: m.colKey, value: newValue });
                } else {
                    const row = data[m.rowIndex] as { id?: string };
                    if (row?.id) await api.patchCell(cuaderno.id, { sheet_id: sheetId, row: row.id, column: m.colKey, value: newValue });
                }
            }
            setLastSavedAt(Date.now());
            onRefresh();
        } finally {
            setSaving(false);
        }
    }, [getReplaceMatches, effectiveImportedIndex, effectiveSheet, hojas, data, cuaderno.id, onRefresh]);

    useEffect(() => {
        if (!editorActionsRef) return;
        editorActionsRef.current = {
            openSearch,
            replacePreview,
            replaceApply,
        };
        return () => {
            editorActionsRef.current = null;
        };
    }, [editorActionsRef, openSearch, replacePreview, replaceApply]);

    const exportPDF = async (params?: { desde?: string; hasta?: string }) => {
        try {
            const checkUrl = api.getExportPDFUrl(cuaderno.id, { check_hojas_editadas: true, ...params });
            const checkRes = await fetch(checkUrl);
            const data = await checkRes.json();

            let queryParams: any = { ...params };
            const checkParams = new URL(checkUrl).searchParams;
            checkParams.forEach((val, key) => queryParams[key] = val);
            delete queryParams.check_hojas_editadas; // remove check flag for final export

            if (data?.tiene_hojas_editadas && data?.hojas_editadas?.length > 0) {
                if (window.confirm(`Hay ${data.hojas_editadas.length} hoja(s) importada(s) editada(s) libre(s). ¿Quieres incluirlas en el PDF?\n\nSi aceptas, se anexarán al final del documento.`)) {
                    queryParams.incluir_hojas = data.hojas_editadas.map((h: any) => h.sheet_id).join(",");
                }
            }
            window.open(api.getExportPDFUrl(cuaderno.id, queryParams), "_blank");
        } catch (e) {
            console.error("Error checking pdf export:", e);
            window.open(api.getExportPDFUrl(cuaderno.id, params), "_blank"); // Fallback
        }
    };

    const exportExcel = async (params?: { desde?: string; hasta?: string }) => {
        try {
            const checkUrl = api.getExportExcelUrl(cuaderno.id, { check_hojas_editadas: true, ...params });
            const checkRes = await fetch(checkUrl);
            const data = await checkRes.json();

            let queryParams: any = { ...params };
            const checkParams = new URL(checkUrl).searchParams;
            checkParams.forEach((val, key) => queryParams[key] = val);
            delete queryParams.check_hojas_editadas; // remove check flag for final export

            if (data?.tiene_hojas_editadas && data?.hojas_editadas?.length > 0) {
                if (window.confirm(`Hay ${data.hojas_editadas.length} hoja(s) importada(s) editada(s) libre(s). ¿Quieres incluirlas en el Excel?\n\nSi aceptas, se anexarán como pestañas nuevas.`)) {
                    queryParams.incluir_hojas = data.hojas_editadas.map((h: any) => h.sheet_id).join(",");
                }
            }
            window.open(api.getExportExcelUrl(cuaderno.id, queryParams), "_blank");
        } catch (e) {
            console.error("Error checking excel export:", e);
            window.open(api.getExportExcelUrl(cuaderno.id, params), "_blank"); // Fallback
        }
    };

    const handleSaveCell = async (rowId: string, colKey: string, newValue: string) => {
        if (!BASE_EDITABLE_SHEETS.includes(effectiveSheet)) return;
        setEditingCell(null);
        const payload = { sheet_id: effectiveSheet, row: rowId, column: colKey, value: newValue };
        setSaving(true);
        try {
            await api.patchCell(cuaderno.id, payload);
            setLastSavedAt(Date.now());
            onRefresh();
        } catch (e) {
            console.error("Error guardando celda:", e);
        } finally {
            setSaving(false);
        }
    };

    const isBaseSheetEditable = BASE_EDITABLE_SHEETS.includes(effectiveSheet);

    const handleDeleteTratamiento = async (tratamientoId: string) => {
        if (!confirm("¿Eliminar este tratamiento? Esta acción no se puede deshacer.")) return;
        try {
            await api.deleteTratamiento(cuaderno.id, tratamientoId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("No se pudo eliminar.");
        }
    };

    const handleDeleteParcela = async (parcelaId: string) => {
        if (!confirm("¿Eliminar esta parcela? Los tratamientos asociados quedarán sin referencia a ella.")) return;
        try {
            await api.deleteParcela(cuaderno.id, parcelaId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("No se pudo eliminar la parcela.");
        }
    };

    const handleDeleteProducto = async (productoId: string) => {
        if (!confirm("¿Eliminar este producto del inventario? Los tratamientos que lo usan conservarán una copia de los datos.")) return;
        try {
            await api.deleteProducto(cuaderno.id, productoId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("No se pudo eliminar el producto.");
        }
    };

    const handleDuplicarTratamiento = async (tratamientoId: string) => {
        try {
            await api.duplicarTratamiento(cuaderno.id, tratamientoId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("No se pudo duplicar.");
        }
    };

    const handleSheetTabClick = (sheet: SheetType) => {
        setActiveImportedSheet(null);
        onSheetChange(sheet);
    };

    const handleImportedTabClick = (index: number) => {
        setActiveImportedSheet(index);
    };

    // Mostrar hoja importada si está seleccionada
    if (effectiveImportedIndex !== null && hojas[effectiveImportedIndex]) {
        const hoja = hojas[effectiveImportedIndex];
        return (
            <div className="flex-1 flex flex-col min-h-0">
                {/* Focus mode header */}
                {isFocusMode && onFocusModeExit && (
                    <div className="h-10 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between px-4 shrink-0">
                        <span className="text-sm text-emerald-400 font-medium">Editando: {focusSheetNombre}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
                            >
                                <ArrowLeft size={14} />
                                Volver al cuaderno
                            </button>
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
                            >
                                <RefreshCw size={14} />
                                Cambiar hoja
                            </button>
                        </div>
                    </div>
                )}
                {/* Barra de búsqueda - hoja importada */}
                {searchOpen && (
                    <div className="h-12 px-4 flex items-center gap-3 border-b border-white/5 bg-[var(--bg-dark)] shrink-0">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchActiveIndex(0); }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? goSearchPrev() : goSearchNext(); }
                                if (e.key === "Escape") { setSearchOpen(false); }
                            }}
                            placeholder="Buscar en la hoja..."
                            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
                        />
                        <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                            {searchQuery.trim() ? (searchResults.length > 0 ? `${searchActiveIndex + 1} / ${searchResults.length}` : "0 / 0") : "0 / 0"}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button type="button" onClick={goSearchPrev} disabled={searchResults.length === 0} className="p-2 rounded-md hover:bg-white/5 text-zinc-400 disabled:opacity-40"><ChevronUp size={16} /></button>
                            <button type="button" onClick={goSearchNext} disabled={searchResults.length === 0} className="p-2 rounded-md hover:bg-white/5 text-zinc-400 disabled:opacity-40"><ChevronDown size={16} /></button>
                        </div>
                        <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-2 rounded-md hover:bg-white/5 text-zinc-400"><X size={16} /></button>
                    </div>
                )}
                {/* Toolbar */}
                <div className="min-h-[48px] py-2 bg-[var(--bg-dark)] border-b border-white/5 flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 electron-drag">
                    <div className="flex items-center gap-3">
                        <Table size={16} className="text-purple-400" />
                        <span className="font-medium text-sm text-zinc-100">{hoja.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
                            Hoja importada (editable)
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 electron-no-drag shrink-0 ml-auto justify-end">
                        <span className="text-xs text-zinc-500">
                            {hoja.datos?.length || 0} filas × {hoja.columnas?.length || 0} columnas
                        </span>
                        <div className="w-px h-5 bg-white/10" />
                        <button
                            onClick={() => exportPDF()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                        >
                            <FileText size={14} />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={() => exportExcel()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                        >
                            <FileSpreadsheet size={14} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <div className="w-px h-5 bg-white/10" />
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                            title="Buscar (⌘F / Ctrl+F)"
                        >
                            <Search size={14} />
                        </button>
                    </div>
                </div>

                {/* Imported Sheet Content - editable en tiempo real, persistido en JSON */}
                <ImportedSheet
                    hoja={hoja}
                    searchResults={effectiveImportedIndex !== null ? searchResults : []}
                    searchActiveIndex={searchActiveIndex}
                    onSendSelectionToChat={onSendSelectionToChat}
                    onSave={async (patch) => {
                        await api.updateHoja(cuaderno.id, hoja.sheet_id, patch);
                        setLastSavedAt(Date.now());
                        onRefresh();
                    }}
                    onPatchCell={async (row, col, value) => {
                        await api.patchCell(cuaderno.id, { sheet_id: hoja.sheet_id, row, column: col, value });
                        setLastSavedAt(Date.now());
                        onRefresh();
                    }}
                    onDelete={async () => {
                        if (!confirm("¿Eliminar esta hoja importada? Se perderán todos los datos. No se puede deshacer.")) return;
                        await api.deleteHoja(cuaderno.id, hoja.sheet_id);
                        setActiveImportedSheet(null);
                        onRefresh();
                    }}
                    onRename={async (newName: string) => {
                        await api.renameHoja(cuaderno.id, hoja.sheet_id, newName);
                        onRefresh();
                    }}
                />

                {/* Sheet Tabs - ocultos en modo focus */}
                {!isFocusMode && renderTabs()}
            </div>
        );
    }

    function renderTabs() {
        return (
            <div className="h-10 bg-[var(--bg-dark)] border-t border-white/5 flex items-center justify-between px-3 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-0.5">
                    {(["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha", "historico"] as SheetType[]).map((sheet) => (
                        <button
                            key={sheet}
                            onClick={() => handleSheetTabClick(sheet)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${effectiveImportedIndex === null && effectiveSheet === sheet
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                }`}
                        >
                            {SHEET_ICONS[sheet]}
                            {SHEET_CONFIG[sheet].title}
                        </button>
                    ))}

                    {hojas.length > 0 && (
                        <div className="w-px h-4 bg-white/10 mx-2" />
                    )}

                    {hojas.map((hoja, idx) => (
                        <button
                            key={`imported_${idx}`}
                            onClick={() => handleImportedTabClick(idx)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${effectiveImportedIndex === idx
                                ? "bg-purple-500/10 text-purple-400"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                }`}
                        >
                            <Table size={12} />
                            {hoja.nombre.length > 15 ? `${hoja.nombre.slice(0, 15)}...` : hoja.nombre}
                        </button>
                    ))}
                </div>

                <span className="text-[11px] text-zinc-500 shrink-0 ml-4">
                    {effectiveImportedIndex !== null
                        ? `${hojas[effectiveImportedIndex]?.datos?.length || 0} filas`
                        : `${data.length} registro${data.length !== 1 ? "s" : ""}`
                    }
                </span>
            </div>
        );
    }

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0">
                {/* Focus mode header - base sheet */}
                {isFocusMode && onFocusModeExit && (
                    <div className="h-10 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between px-4 shrink-0">
                        <span className="text-sm text-emerald-400 font-medium">Editando: {focusSheetNombre}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
                            >
                                <ArrowLeft size={14} />
                                Volver al cuaderno
                            </button>
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
                            >
                                <RefreshCw size={14} />
                                Cambiar hoja
                            </button>
                        </div>
                    </div>
                )}
                {/* Toolbar — IDE: cuaderno, hoja activa, hints */}
                <div className="min-h-[48px] py-2 bg-[var(--bg-dark)] border-b border-white/5 flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 electron-drag">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-sm text-zinc-100 truncate">{cuaderno.nombre_explotacion}</span>
                        <span className="text-zinc-500 text-xs">·</span>
                        <span className="text-xs text-zinc-400 truncate" title="Hoja activa">
                            {effectiveImportedIndex !== null
                                ? (hojas[effectiveImportedIndex]?.nombre || "Hoja importada")
                                : (SHEET_CONFIG[effectiveSheet]?.title ?? effectiveSheet)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md ${saving ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                            {saving ? "Guardando…" : "Guardado ✓"}
                        </span>
                        {hojas.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
                                {hojas.length} hojas importadas
                            </span>
                        )}
                        <span className="hidden sm:inline-flex items-center gap-2 text-[10px] text-zinc-500 ml-2">
                            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘F</kbd> Buscar
                            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘K</kbd> Comandos
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 electron-no-drag shrink-0 ml-auto justify-end">
                        {/* Filtro por cultivo - solo en parcelas */}
                        {effectiveSheet === "parcelas" && uniqueCultivos.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Filter size={14} className="text-zinc-500 hidden sm:block" />
                                <select
                                    value={cultivoFilter}
                                    onChange={(e) => { setCultivoFilter(e.target.value); setSelectedParcelas(new Set()); }}
                                    className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40 min-w-[100px]"
                                >
                                    <option value="">Todos los cultivos</option>
                                    {uniqueCultivos.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <select
                                    value={parcelSortMode}
                                    onChange={(e) => setParcelSortMode(e.target.value as ParcelSortMode)}
                                    className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40"
                                >
                                    <option value="cultivo_superficie">Orden: cultivo + superficie</option>
                                    <option value="num_orden">Orden: Original / IA</option>
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={targetHectareas}
                                    onChange={(e) => setTargetHectareas(e.target.value)}
                                    placeholder="ha objetivo"
                                    className="w-24 rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
                                />
                                <button
                                    type="button"
                                    onClick={autoSelectByHectareas}
                                    className="px-2.5 py-1.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs transition-colors whitespace-nowrap"
                                >
                                    Auto-seleccionar ha
                                </button>
                                <div className="w-px h-5 bg-white/10" />
                            </div>
                        )}
                        {effectiveSheet !== "historico" && (
                            <button
                                onClick={() => { setOpenTreatFromSelection(false); setShowAddModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-colors ml-auto sm:ml-0"
                            >
                                <Plus size={14} />
                                Añadir
                            </button>
                        )}
                        <div className="w-px h-5 bg-white/10" />
                        <button
                            onClick={() => exportPDF(
                                effectiveSheet === "historico"
                                    ? { desde: historicoFilters.date_from, hasta: historicoFilters.date_to }
                                    : undefined
                            )}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                        >
                            <FileText size={14} />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={() => exportExcel(
                                effectiveSheet === "historico"
                                    ? { desde: historicoFilters.date_from, hasta: historicoFilters.date_to }
                                    : undefined
                            )}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                        >
                            <FileSpreadsheet size={14} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <div className="w-px h-5 bg-white/10" />
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                            title="Buscar en hoja (⌘F / Ctrl+F)"
                        >
                            <Search size={14} />
                        </button>
                    </div>
                </div>

                {/* Barra de búsqueda */}
                {searchOpen && (
                    <div className="h-12 px-4 flex items-center gap-3 border-b border-white/5 bg-[var(--bg-dark)] shrink-0">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchActiveIndex(0); }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? goSearchPrev() : goSearchNext(); }
                                if (e.key === "Escape") { setSearchOpen(false); }
                            }}
                            placeholder="Buscar en la hoja..."
                            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
                        />
                        <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                            {searchQuery.trim() ? (searchResults.length > 0 ? `${searchActiveIndex + 1} / ${searchResults.length}` : "0 / 0") : "0 / 0"}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={goSearchPrev}
                                disabled={searchResults.length === 0}
                                className="p-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Anterior (Shift+Enter)"
                            >
                                <ChevronUp size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={goSearchNext}
                                disabled={searchResults.length === 0}
                                className="p-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Siguiente (Enter)"
                            >
                                <ChevronDown size={16} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                            className="p-2 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Filtros histórico */}
                {effectiveSheet === "historico" && (
                    <div className="px-4 py-2 border-b border-white/5 bg-[var(--bg-dark)] flex flex-wrap items-center gap-3">
                        <span className="text-xs text-zinc-500">Filtros:</span>
                        <select
                            value={historicoFilters.parcela_id || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, parcela_id: e.target.value || undefined }))}
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200"
                        >
                            <option value="">Todas las parcelas</option>
                            {(cuaderno.parcelas || []).map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={historicoFilters.date_from || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, date_from: e.target.value || undefined }))}
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200"
                            placeholder="Desde"
                        />
                        <input
                            type="date"
                            value={historicoFilters.date_to || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200"
                            placeholder="Hasta"
                        />
                        <select
                            value={historicoFilters.product_id || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, product_id: e.target.value || undefined }))}
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200"
                        >
                            <option value="">Todos los productos</option>
                            {(cuaderno.productos || []).map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre_comercial}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={historicoFilters.num_lote || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, num_lote: e.target.value || undefined }))}
                            placeholder="Nº Lote"
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-zinc-200 w-28"
                        />
                    </div>
                )}

                {/* Barra sumatorio hectáreas */}
                {effectiveSheet === "parcelas" && hectareasSummary && (
                    <div className="px-4 py-2.5 border-b border-white/5 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-emerald-400" />
                                <span className="text-xs text-zinc-400">Total:</span>
                                <span className="text-sm font-semibold text-zinc-100">{hectareasSummary.total} parcelas</span>
                                <span className="text-xs text-zinc-500">·</span>
                                <span className="text-sm font-semibold text-emerald-400">{Number(hectareasSummary.totalHa || 0).toFixed(2)} ha</span>
                            </div>
                            {hectareasSummary.selected > 0 && (
                                <>
                                    <div className="w-px h-5 bg-white/10" />
                                    <div className="flex items-center gap-2">
                                        <CheckSquare size={14} className="text-blue-400" />
                                        <span className="text-xs text-zinc-400">Seleccionadas:</span>
                                        <span className="text-sm font-semibold text-blue-400">{hectareasSummary.selected} parcelas</span>
                                        <span className="text-xs text-zinc-500">·</span>
                                        <span className="text-sm font-bold text-blue-300">{Number(hectareasSummary.selectedHa || 0).toFixed(2)} ha</span>
                                    </div>
                                </>
                            )}
                        </div>
                        {hectareasSummary.selected > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={sendParcelaCheckboxesToChat}
                                    disabled={!onSendSelectionToChat}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                    <Send size={13} />
                                    Enviar al Chat
                                </button>
                                <button
                                    onClick={() => { setOpenTreatFromSelection(true); setShowAddModal(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs transition-colors"
                                >
                                    <ClipboardList size={13} />
                                    Formulario
                                </button>
                                <button
                                    onClick={() => setSelectedParcelas(new Set())}
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Spreadsheet */}
                <div className="flex-1 overflow-auto bg-[var(--bg-darker)]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[var(--bg-dark)]">
                                {effectiveSheet === "parcelas" && (
                                    <th className="w-10 px-2 py-2.5 text-center border-b border-r border-white/5">
                                        <button
                                            type="button"
                                            onClick={toggleSelectAll}
                                            className="text-zinc-500 hover:text-emerald-400 transition-colors"
                                            title="Seleccionar todo"
                                        >
                                            {selectedParcelas.size > 0 && selectedParcelas.size === (displayData as any[]).length
                                                ? <CheckSquare size={15} className="text-emerald-400" />
                                                : <Square size={15} />
                                            }
                                        </button>
                                    </th>
                                )}
                                <th className="w-12 px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider border-b border-r border-white/5 cursor-pointer hover:bg-white/5"
                                    onClick={() => clearCellSelection()}
                                    title="Limpiar selección de celdas"
                                >
                                    #
                                </th>
                                {config.columns.map((col, colIdx) => (
                                    <th
                                        key={col.key}
                                        style={{ width: col.width }}
                                        className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider border-b border-r border-white/5 whitespace-nowrap cursor-pointer hover:bg-white/5 hover:text-zinc-300 transition-colors select-none"
                                        onClick={() => handleSelectColumn(colIdx)}
                                        title={`Seleccionar columna "${col.label}"`}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th className="w-24 px-3 py-2.5 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider border-b border-white/5">

                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={config.columns.length + (effectiveSheet === "parcelas" ? 3 : 2)}
                                        className="px-8 py-16 text-center text-zinc-500"
                                    >
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
                                                {SHEET_ICONS[effectiveSheet]}
                                            </div>
                                            <p>{cultivoFilter ? `Sin parcelas con cultivo "${cultivoFilter}"` : `Sin datos en ${config.title.toLowerCase()}`}</p>
                                            {effectiveSheet !== "historico" && !cultivoFilter && (
                                                <button
                                                    onClick={() => setShowAddModal(true)}
                                                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                                                >
                                                    <Plus size={16} />
                                                    Añadir {effectiveSheet === "parcelas" ? "parcela" : effectiveSheet === "productos" ? "producto" : "tratamiento"}
                                                </button>
                                            )}
                                            {cultivoFilter && (
                                                <button
                                                    onClick={() => setCultivoFilter("")}
                                                    className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                                                >
                                                    Limpiar filtro
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((row: any, idx: number) => {
                                    const isHighlighted =
                                        highlight &&
                                        highlight.sheet === effectiveSheet &&
                                        row.id &&
                                        highlight.id === row.id;
                                    const isSelected = effectiveSheet === "parcelas" && selectedParcelas.has(row.id);

                                    return (
                                        <tr
                                            key={row.id || idx}
                                            className={`group hover:bg-white/[0.03] transition-colors ${isHighlighted ? "bg-emerald-500/15 ring-1 ring-emerald-500/50" : ""} ${isSelected ? "bg-blue-500/10" : ""}`}
                                        >
                                            {effectiveSheet === "parcelas" && (
                                                <td className="px-2 py-2 text-center border-b border-r border-white/5 bg-[var(--bg-dark)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleParcelaSelection(row.id)}
                                                        className="text-zinc-500 hover:text-emerald-400 transition-colors"
                                                    >
                                                        {isSelected
                                                            ? <CheckSquare size={15} className="text-blue-400" />
                                                            : <Square size={15} />
                                                        }
                                                    </button>
                                                </td>
                                            )}
                                            <td
                                                className="px-3 py-2 text-zinc-500 text-xs font-mono border-b border-r border-white/5 bg-[var(--bg-dark)] cursor-pointer hover:bg-white/5 select-none"
                                                onClick={() => handleSelectRow(idx)}
                                                title={`Seleccionar fila ${idx + 1}`}
                                            >
                                                {idx + 1}
                                            </td>
                                            {config.columns.map((col) => {
                                                const isEditing = isBaseSheetEditable && editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                                                const raw = row[col.key];
                                                const display = col.key === "estado"
                                                    ? null
                                                    : col.key === "num_orden_parcelas" && effectiveSheet === "tratamientos"
                                                        ? (
                                                            <div className="flex items-center justify-between group/link h-full w-full">
                                                                <span className="truncate pr-2">{formatCellValue(raw, col.type)}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowTratamientoDetalleId(row.id);
                                                                    }}
                                                                    className="p-1 rounded-md bg-white/5 opacity-0 group-hover/link:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 focus:opacity-100 transition-all text-zinc-400 shrink-0"
                                                                    title="Ver parcelas vinculadas"
                                                                >
                                                                    <MapPin size={12} />
                                                                </button>
                                                            </div>
                                                        )
                                                        : formatCellValue(raw, col.type);
                                                const matchIdx = effectiveImportedIndex === null
                                                    ? searchResults.findIndex((m) => m.rowIndex === idx && m.colKey === col.key)
                                                    : -1;
                                                const isSearchMatch = matchIdx >= 0;
                                                const isActiveMatch = matchIdx === searchActiveIndex;
                                                const isCellSelected = selectedCells.has(`${idx}:${col.key}`);
                                                return (
                                                    <td
                                                        key={col.key}
                                                        data-search-row={idx}
                                                        data-search-col={col.key}
                                                        onClick={(e) => {
                                                            // No seleccionar si estamos editando
                                                            if (editingCell?.rowId === row.id && editingCell?.colKey === col.key) return;
                                                            const colIndex = config.columns.findIndex(c => c.key === col.key);
                                                            handleCellClick(idx, colIndex, e);
                                                        }}
                                                        onDoubleClick={() => {
                                                            // Doble-click = entrar en modo edición
                                                            if (isBaseSheetEditable && row.id && col.editable !== false) {
                                                                setEditingCell({ rowId: row.id, colKey: col.key });
                                                                setEditValue(raw !== null && raw !== undefined && raw !== "" ? String(raw) : "");
                                                            }
                                                        }}
                                                        className={`px-3 py-2 text-zinc-300 border-b border-r border-white/5 cursor-pointer select-none transition-colors ${isCellSelected
                                                            ? "bg-blue-500/20 ring-1 ring-inset ring-blue-500/40"
                                                            : isSearchMatch
                                                                ? (isActiveMatch ? "bg-amber-500/30 ring-1 ring-amber-500/60" : "bg-amber-500/15")
                                                                : ""
                                                            }`}
                                                    >
                                                        {col.key === "estado" ? (
                                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${raw === "aplicado"
                                                                ? "bg-emerald-500/20 text-emerald-400"
                                                                : raw === "pendiente"
                                                                    ? "bg-amber-500/20 text-amber-400"
                                                                    : "bg-white/10 text-zinc-400"
                                                                }`}>
                                                                {raw || "-"}
                                                            </span>
                                                        ) : isEditing ? (
                                                            <input
                                                                autoFocus
                                                                className="w-full min-w-[80px] px-2 py-1 rounded bg-white/10 border border-emerald-500/50 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onBlur={() => handleSaveCell(row.id, col.key, editValue)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.currentTarget.blur();
                                                                    }
                                                                    if (e.key === "Escape") {
                                                                        setEditingCell(null);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className={`block w-full text-left min-h-[28px] rounded px-1 -mx-1 ${isBaseSheetEditable && row.id ? "hover:bg-white/5" : ""}`}>
                                                                {display}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 border-b border-white/5">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {effectiveSheet === "tratamientos" && row.id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowTratamientoDetalleId(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-emerald-400"
                                                                title="Ver parcelas"
                                                            >
                                                                <MapPin size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditTratamientoId(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDuplicarTratamiento(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                                                                title="Duplicar"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTratamiento(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {effectiveSheet === "parcelas" && row.id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => loadParcelaTratamientos(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-amber-400"
                                                                title="Ver tratamientos previos"
                                                            >
                                                                <History size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onRequestHighlight?.(effectiveSheet, row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                                                                title="Ver"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteParcela(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {effectiveSheet === "productos" && row.id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => onRequestHighlight?.(effectiveSheet, row.id)}
                                                                className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                                                                title="Ver"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteProducto(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Floating Cell Selection Bar */}
                {selectedCells.size > 0 && (
                    <div className="px-4 py-2.5 border-t border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                                    <Table2 size={14} className="text-blue-400" />
                                </div>
                                <span className="text-xs text-zinc-400">Selección:</span>
                                <span className="text-sm font-semibold text-blue-300">{selectedCells.size} celda{selectedCells.size !== 1 ? "s" : ""}</span>
                                <span className="text-xs text-zinc-500">·</span>
                                <span className="text-xs text-zinc-400">
                                    {(() => {
                                        const rows = new Set<number>();
                                        for (const key of selectedCells) rows.add(parseInt(key.split(":")[0]));
                                        return `${rows.size} fila${rows.size !== 1 ? "s" : ""}`;
                                    })()}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {BASE_EDITABLE_SHEETS.includes(effectiveSheet) && (
                                <>
                                    <input
                                        type="text"
                                        value={bulkEditValue}
                                        onChange={(e) => setBulkEditValue(e.target.value)}
                                        placeholder="Nuevo valor para todas"
                                        className="w-52 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-blue-500/50"
                                    />
                                    <button
                                        onClick={applyBulkEditToSelection}
                                        disabled={bulkApplying}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {bulkApplying ? "Aplicando..." : "Aplicar a selección"}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleSendToChat}
                                disabled={!onSendSelectionToChat}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={13} />
                                Enviar al Chat
                            </button>
                            <button
                                onClick={clearCellSelection}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                            >
                                <X size={13} />
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}

                {/* Sheet Tabs - ocultos en modo focus */}
                {!isFocusMode && renderTabs()}
            </div>

            {/* Add / Edit Row Modal */}
            <AddRowModal
                isOpen={showAddModal || !!editTratamientoId}
                onClose={() => { setShowAddModal(false); setEditTratamientoId(null); setOpenTreatFromSelection(false); }}
                sheet={openTreatFromSelection ? "tratamientos" : effectiveSheet}
                cuaderno={cuaderno}
                editTratamientoId={editTratamientoId ?? undefined}
                initialParcelaIds={openTreatFromSelection ? Array.from(selectedParcelas) : []}
                onSuccess={() => {
                    setShowAddModal(false);
                    setEditTratamientoId(null);
                    setOpenTreatFromSelection(false);
                    setSelectedParcelas(new Set());
                    onRefresh();
                }}
            />

            {/* Modal Tratamientos Previos de Parcela */}
            {showTratamientosParcelaId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTratamientosParcelaId(null)} />
                    <div className="relative bg-[var(--bg-dark)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <History size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-100">Tratamientos Previos</h3>
                                    <p className="text-xs text-zinc-500">
                                        {(() => {
                                            const p = (cuaderno.parcelas || []).find((p: any) => p.id === showTratamientosParcelaId);
                                            return p ? `${p.nombre || p.especie || 'Parcela'} — ${p.superficie_cultivada || p.superficie_ha || 0} ha` : 'Parcela';
                                        })()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTratamientosParcelaId(null)}
                                className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingTratamientos ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="ml-3 text-sm text-zinc-500">Cargando tratamientos...</span>
                                </div>
                            ) : parcelaTratamientos.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 mx-auto mb-3">
                                        <ClipboardList size={24} />
                                    </div>
                                    <p className="text-sm text-zinc-400">Sin tratamientos registrados para esta parcela</p>
                                    <p className="text-xs text-zinc-600 mt-1">Los tratamientos aparecerán aquí cuando se registren</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {parcelaTratamientos.map((t: any, index: number) => (
                                        <div key={t.id || index} className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                                                        {t.fecha_aplicacion ? new Date(t.fecha_aplicacion).toLocaleDateString('es-ES') : '-'}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${t.estado === 'aplicado' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        t.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-white/10 text-zinc-400'
                                                        }`}>
                                                        {t.estado || 'registrado'}
                                                    </span>
                                                </div>
                                                {t.eficacia && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400">
                                                        Eficacia: {t.eficacia}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                                <div><span className="text-zinc-500">Problema:</span> <span className="text-zinc-300">{t.problema_fitosanitario || t.plaga_enfermedad || '-'}</span></div>
                                                <div><span className="text-zinc-500">Superficie:</span> <span className="text-zinc-300">{t.superficie_tratada || 0} ha</span></div>
                                                {t.productos && t.productos.length > 0 && (
                                                    <div className="col-span-2 mt-1">
                                                        <span className="text-zinc-500">Productos:</span>
                                                        <div className="mt-1 space-y-0.5">
                                                            {t.productos.map((p: any, pi: number) => (
                                                                <div key={pi} className="flex items-center gap-2 text-zinc-300 pl-2 border-l-2 border-emerald-500/30">
                                                                    <span className="font-medium">{p.nombre_comercial}</span>
                                                                    <span className="text-zinc-500">—</span>
                                                                    <span>{p.dosis} {p.unidad_dosis}</span>
                                                                    {p.numero_registro && <span className="text-zinc-600">({p.numero_registro})</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {t.operador && <div><span className="text-zinc-500">Operador:</span> <span className="text-zinc-300">{t.operador}</span></div>}
                                                {t.observaciones && <div className="col-span-2"><span className="text-zinc-500">Notas:</span> <span className="text-zinc-300">{t.observaciones}</span></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between bg-black/20 shrink-0">
                            <span className="text-xs text-zinc-500">{parcelaTratamientos.length} tratamiento(s)</span>
                            <button
                                onClick={() => setShowTratamientosParcelaId(null)}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Parcelas de Tratamiento */}
            {showTratamientoDetalleId && (() => {
                const t = (cuaderno.tratamientos || []).find((t: any) => t.id === showTratamientoDetalleId);
                const relatedParcelas = t?.parcela_ids ? (cuaderno.parcelas || []).filter(p => t.parcela_ids.includes(p.id)) : [];
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTratamientoDetalleId(null)} />
                        <div className="relative bg-[var(--bg-dark)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <MapPin size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-100">Parcelas del Tratamiento</h3>
                                        <p className="text-xs text-zinc-500">
                                            {t?.fecha_aplicacion ? new Date(t.fecha_aplicacion).toLocaleDateString('es-ES') : ''} • {Number(t?.superficie_tratada || 0).toFixed(2)} ha totales
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowTratamientoDetalleId(null)}
                                    className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 max-h-[60vh]">
                                {relatedParcelas.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-zinc-400">No se encontraron parcelas vinculadas a este tratamiento.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {relatedParcelas.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors gap-3">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-zinc-200">{p.nombre || 'Sin nombre'}</span>
                                                        {p.num_orden ? (
                                                            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                                                Nº {p.num_orden}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 bg-black/20 px-2 py-1 rounded inline-block">
                                                        {p.num_poligono && p.num_parcela
                                                            ? `Pol ${p.num_poligono} • Parc ${p.num_parcela} • Rec ${p.num_recinto || '-'}`
                                                            : 'Sin datos SIGPAC'}
                                                        {p.termino_municipal && ` • ${p.termino_municipal}`}
                                                    </div>
                                                </div>
                                                <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0">
                                                    <div className="text-sm font-bold text-emerald-400">
                                                        {Number(p.superficie_cultivada || p.superficie_ha || p.superficie_sigpac || 0).toFixed(2)} ha
                                                    </div>
                                                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                                        {p.cultivo || p.especie || 'Sin cultivo'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between bg-black/20 shrink-0">
                                <span className="text-xs text-zinc-500">{relatedParcelas.length} parcela(s) vinculadas</span>
                                <button
                                    onClick={() => setShowTratamientoDetalleId(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
