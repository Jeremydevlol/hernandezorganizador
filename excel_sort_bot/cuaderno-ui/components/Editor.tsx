"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
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
    Send,
    Palette
} from "lucide-react";
import { Cuaderno, SheetType, SHEET_CONFIG, HistoricoRow, HojaExcel, CellSelection } from "@/lib/types";
import { fechaFlexibleAISO, formatDateTableES } from "@/lib/dateSpanish";
import { parseDecimalInput } from "@/lib/parseDecimal";
import { api } from "@/lib/api";
import AddRowModal from "./modals/AddRowModal";
import AddBulkModal from "./modals/AddBulkModal";
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
const BULK_EDIT_SHEETS: SheetType[] = ["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha"];

const BASE_SHEET_IDS: SheetType[] = ["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha", "historico"];
/** Hojas base con casilla de selección y color de fila */
const SHEETS_WITH_ROW_SELECT: SheetType[] = ["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha"];
const ROW_COLOR_SWATCHES = ["#ffffff", "#fef3c7", "#fde68a", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fbcfe8", "#fecaca"] as const;
type ParcelSortMode = "num_orden" | "cultivo_superficie" | "cultivo" | "alfabetico" | "superficie_desc" | "superficie_asc" | "termino_municipal" | "todo_az";
type TratSortMode = "fecha_desc" | "fecha_asc" | "cultivo" | "parcela" | "producto";

/** Filtro del desplegable: igualdad exacta (trim + minúsculas). Evita que "AVENA" incluya "AVENA/COLIFLOR". */
function cultivoCoincideConFiltro(celdaCultivo: string, filtro: string): boolean {
    const f = (filtro || "").trim().toLowerCase();
    if (!f) return true;
    const c = (celdaCultivo || "").trim().toLowerCase();
    return c === f;
}

export default function Editor({ cuaderno, activeSheet, onSheetChange, onRefresh, highlight, onRequestHighlight, focusSheetId = null, onFocusModeExit, editorActionsRef, onSendSelectionToChat }: EditorProps) {
    const [historico, setHistorico] = useState<HistoricoRow[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
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
    const [selectedTratamientos, setSelectedTratamientos] = useState<Set<string>>(new Set());
    const [selectedProductos, setSelectedProductos] = useState<Set<string>>(new Set());
    const [selectedFertilizaciones, setSelectedFertilizaciones] = useState<Set<string>>(new Set());
    const [selectedCosechas, setSelectedCosechas] = useState<Set<string>>(new Set());
    const [cultivoFilter, setCultivoFilter] = useState<string>("");
    const [parcelaTratamientoFilter, setParcelaTratamientoFilter] = useState<"" | "con_tratamiento" | "sin_tratamiento">("");
    const [tratCultivoFilter, setTratCultivoFilter] = useState<string>("");
    const [parcelSortMode, setParcelSortMode] = useState<ParcelSortMode>("num_orden");
    const [tratSortMode, setTratSortMode] = useState<TratSortMode>("fecha_desc");
    const [targetHectareas, setTargetHectareas] = useState<string>("");
    const [showTratamientosParcelaId, setShowTratamientosParcelaId] = useState<string | null>(null);
    const [showTratamientoDetalleId, setShowTratamientoDetalleId] = useState<string | null>(null);
    const [parcelaTratamientos, setParcelaTratamientos] = useState<any[]>([]);
    const [loadingTratamientos, setLoadingTratamientos] = useState(false);
    const [openTreatFromSelection, setOpenTreatFromSelection] = useState(false);
    const [openTreatFromTratSelection, setOpenTreatFromTratSelection] = useState(false);
    const [openFertFromSelection, setOpenFertFromSelection] = useState(false);
    // ---- Selección de celdas para Chat ----
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // "rowIdx:colKey"
    const [selectionAnchor, setSelectionAnchor] = useState<{ rowIdx: number; colIdx: number } | null>(null);
    const [bulkEditValue, setBulkEditValue] = useState("");
    const [pasteValues, setPasteValues] = useState("");
    const [buscarValue, setBuscarValue] = useState("");
    const [reemplazarValue, setReemplazarValue] = useState("");
    const [bulkApplying, setBulkApplying] = useState(false);
    const [copyToParcelsId, setCopyToParcelsId] = useState<string | null>(null);
    const [copyTargetParcelas, setCopyTargetParcelas] = useState<Set<string>>(new Set());
    const [copyingToParcels, setCopyingToParcels] = useState(false);
    const [exportHojasModal, setExportHojasModal] = useState<{ hojas: { sheet_id: string; nombre: string; num_filas: number }[]; type: "pdf" | "excel"; params: Record<string, any> } | null>(null);
    const [selectedExportHojas, setSelectedExportHojas] = useState<Set<string>>(new Set());
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
        setSelectedParcelas(new Set());
        setSelectedTratamientos(new Set());
        setSelectedProductos(new Set());
        setSelectedFertilizaciones(new Set());
        setSelectedCosechas(new Set());
    }, [effectiveSheet]);

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
                return (cuaderno.tratamientos || []).map(t => {
                    const prod = t.productos?.[0] || {};
                    const probProd = String((prod as any).problema_fitosanitario || (prod as any).plaga_enfermedad || "").trim();
                    const probTrat = String(t.problema_fitosanitario || t.plaga_enfermedad || "").trim();
                    return {
                        ...t,
                        parcela_nombres: t.parcela_nombres?.join(", ") || "",
                        nombre_comercial: (prod as any).nombre_comercial || "",
                        numero_registro: (prod as any).numero_registro || "",
                        dosis: (prod as any).dosis ?? "",
                        unidad_dosis: (prod as any).unidad_dosis || "",
                        problema_fitosanitario: probTrat || probProd,
                    };
                });
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

    const uniqueCultivosTrat = useMemo(() => {
        const tratamientos = cuaderno.tratamientos || [];
        const cultivos = [...new Set(tratamientos.map((t: any) => t.cultivo_especie || "").filter(Boolean))];
        return cultivos.sort();
    }, [cuaderno.tratamientos]);

    // Parcelas que tienen al menos un tratamiento (para filtro "con/sin tratamiento")
    const parcelaIdsConTratamiento = useMemo(() => {
        const ids = new Set<string>();
        for (const t of cuaderno.tratamientos || []) {
            for (const pid of t.parcela_ids || []) {
                if (pid) ids.add(pid);
            }
        }
        return ids;
    }, [cuaderno.tratamientos]);

    /** Nº orden SIGPAC por id de parcela (para ordenar tratamientos igual que la hoja de parcelas) */
    const parcelaNumOrdenById = useMemo(() => {
        const m = new Map<string, number>();
        for (const p of cuaderno.parcelas || []) {
            if (p?.id) m.set(p.id, Number(p.num_orden) || 0);
        }
        return m;
    }, [cuaderno.parcelas]);

    const minNumOrdenTratamiento = useCallback(
        (t: any) => {
            let min = 1e9;
            for (const pid of t.parcela_ids || []) {
                if (!pid) continue;
                const o = parcelaNumOrdenById.get(pid);
                if (o !== undefined && o < min) min = o;
            }
            if (min === 1e9) {
                const raw = String(t.num_orden_parcelas || "").trim();
                if (raw) {
                    for (const part of raw.split(/[,;\s]+/)) {
                        const n = parseInt(part, 10);
                        if (!isNaN(n) && n < min) min = n;
                    }
                }
            }
            return min === 1e9 ? 999999 : min;
        },
        [parcelaNumOrdenById]
    );

    // ---- Data filtrada por cultivo y orden ----
    const displayData = useMemo(() => {
        if (effectiveSheet === "tratamientos") {
            const tratamientos = (data as any[]).filter((t: any) => {
                if (!tratCultivoFilter) return true;
                const cultivo = t.cultivo_especie || "";
                return cultivoCoincideConFiltro(cultivo, tratCultivoFilter);
            });
            const sorted = [...tratamientos].sort((a: any, b: any) => {
                const aFecha = String(a.fecha_aplicacion || "").toLowerCase();
                const bFecha = String(b.fecha_aplicacion || "").toLowerCase();
                const aCultivo = String(a.cultivo_especie || "").toLowerCase();
                const bCultivo = String(b.cultivo_especie || "").toLowerCase();
                const aParcela = String(a.parcela_nombres || a.num_orden_parcelas || "").toLowerCase();
                const bParcela = String(b.parcela_nombres || b.num_orden_parcelas || "").toLowerCase();
                const aProd = String((a.productos?.[0] as any)?.nombre_comercial || "").toLowerCase();
                const bProd = String((b.productos?.[0] as any)?.nombre_comercial || "").toLowerCase();
                switch (tratSortMode) {
                    case "fecha_asc":
                        if (aFecha !== bFecha) return aFecha.localeCompare(bFecha, "es");
                        return (a.id || "").localeCompare(b.id || "");
                    case "cultivo":
                        if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es");
                        return bFecha.localeCompare(aFecha, "es");
                    case "parcela": {
                        const ao = minNumOrdenTratamiento(a);
                        const bo = minNumOrdenTratamiento(b);
                        if (ao !== bo) return ao - bo;
                        if (aParcela !== bParcela) return aParcela.localeCompare(bParcela, "es");
                        return aFecha.localeCompare(bFecha, "es");
                    }
                    case "producto":
                        if (aProd !== bProd) return aProd.localeCompare(bProd, "es");
                        return bFecha.localeCompare(aFecha, "es");
                    case "fecha_desc":
                    default:
                        if (bFecha !== aFecha) return bFecha.localeCompare(aFecha, "es");
                        return (a.id || "").localeCompare(b.id || "");
                }
            });
            return sorted;
        }
        if (effectiveSheet !== "parcelas") return data;
        const filtered = (data as any[]).filter((row: any) => {
            if (cultivoFilter) {
                const cultivo = row.especie || row.cultivo || "";
                if (!cultivoCoincideConFiltro(cultivo, cultivoFilter)) return false;
            }
            if (parcelaTratamientoFilter) {
                const tieneTratamiento = parcelaIdsConTratamiento.has(row.id || "");
                if (parcelaTratamientoFilter === "con_tratamiento" && !tieneTratamiento) return false;
                if (parcelaTratamientoFilter === "sin_tratamiento" && tieneTratamiento) return false;
            }
            return true;
        });

        const sorted = [...filtered].sort((a: any, b: any) => {
            const aOrden = Number(a.num_orden || 0);
            const bOrden = Number(b.num_orden || 0);
            const aCultivo = String(a.especie || a.cultivo || "").toLowerCase();
            const bCultivo = String(b.especie || b.cultivo || "").toLowerCase();
            const aSup = Number(a.superficie_cultivada || a.superficie_ha || a.superficie_sigpac || 0);
            const bSup = Number(b.superficie_cultivada || b.superficie_ha || b.superficie_sigpac || 0);
            const aNombre = String(a.nombre || "").toLowerCase();
            const bNombre = String(b.nombre || "").toLowerCase();
            const aTermino = String(a.termino_municipal || "").toLowerCase();
            const bTermino = String(b.termino_municipal || "").toLowerCase();

            switch (parcelSortMode) {
                case "todo_az":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    if (aTermino !== bTermino) return aTermino.localeCompare(bTermino, "es", { sensitivity: "base" });
                    if (aNombre !== bNombre) return aNombre.localeCompare(bNombre, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "cultivo":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "alfabetico":
                    if (aNombre !== bNombre) return aNombre.localeCompare(bNombre, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "superficie_desc":
                    if (bSup !== aSup) return bSup - aSup;
                    return aOrden - bOrden;
                case "superficie_asc":
                    if (aSup !== bSup) return aSup - bSup;
                    return aOrden - bOrden;
                case "termino_municipal":
                    if (aTermino !== bTermino) return aTermino.localeCompare(bTermino, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "cultivo_superficie":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    if (bSup !== aSup) return bSup - aSup;
                    return aOrden - bOrden;
                case "num_orden":
                default:
                    if (aOrden !== bOrden) return aOrden - bOrden;
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    return bSup - aSup;
            }
        });
        return sorted;
    }, [data, effectiveSheet, cultivoFilter, parcelaTratamientoFilter, parcelaIdsConTratamiento, parcelSortMode, tratCultivoFilter, tratSortMode, minNumOrdenTratamiento]);

    // ---- Orden para exportar (parcelas con el orden actual del editor) ----
    const sortedParcelasForExport = useMemo(() => {
        const parcelas = (cuaderno.parcelas || []) as any[];
        return [...parcelas].sort((a: any, b: any) => {
            const aOrden = Number(a.num_orden || 0);
            const bOrden = Number(b.num_orden || 0);
            const aCultivo = String(a.especie || a.cultivo || "").toLowerCase();
            const bCultivo = String(b.especie || b.cultivo || "").toLowerCase();
            const aSup = Number(a.superficie_cultivada || a.superficie_ha || a.superficie_sigpac || 0);
            const bSup = Number(b.superficie_cultivada || b.superficie_ha || b.superficie_sigpac || 0);
            const aNombre = String(a.nombre || "").toLowerCase();
            const bNombre = String(b.nombre || "").toLowerCase();
            const aTermino = String(a.termino_municipal || "").toLowerCase();
            const bTermino = String(b.termino_municipal || "").toLowerCase();
            switch (parcelSortMode) {
                case "todo_az":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    if (aTermino !== bTermino) return aTermino.localeCompare(bTermino, "es", { sensitivity: "base" });
                    if (aNombre !== bNombre) return aNombre.localeCompare(bNombre, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "cultivo":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "alfabetico":
                    if (aNombre !== bNombre) return aNombre.localeCompare(bNombre, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "superficie_desc":
                    if (bSup !== aSup) return bSup - aSup;
                    return aOrden - bOrden;
                case "superficie_asc":
                    if (aSup !== bSup) return aSup - bSup;
                    return aOrden - bOrden;
                case "termino_municipal":
                    if (aTermino !== bTermino) return aTermino.localeCompare(bTermino, "es", { sensitivity: "base" });
                    return aOrden - bOrden;
                case "cultivo_superficie":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    if (bSup !== aSup) return bSup - aSup;
                    return aOrden - bOrden;
                case "num_orden":
                default:
                    if (aOrden !== bOrden) return aOrden - bOrden;
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es", { sensitivity: "base" });
                    return bSup - aSup;
            }
        });
    }, [cuaderno.parcelas, parcelSortMode]);

    const sortedTratamientosForExport = useMemo(() => {
        const tratamientos = [...(cuaderno.tratamientos || [])] as any[];
        tratamientos.sort((a: any, b: any) => {
            const aFecha = String(a.fecha_aplicacion || "").toLowerCase();
            const bFecha = String(b.fecha_aplicacion || "").toLowerCase();
            const aCultivo = String(a.cultivo_especie || "").toLowerCase();
            const bCultivo = String(b.cultivo_especie || "").toLowerCase();
            const aParcela = String(a.parcela_nombres || a.num_orden_parcelas || "").toLowerCase();
            const bParcela = String(b.parcela_nombres || b.num_orden_parcelas || "").toLowerCase();
            const aProd = String((a.productos?.[0] as any)?.nombre_comercial || "").toLowerCase();
            const bProd = String((b.productos?.[0] as any)?.nombre_comercial || "").toLowerCase();
            switch (tratSortMode) {
                case "fecha_asc":
                    if (aFecha !== bFecha) return aFecha.localeCompare(bFecha, "es");
                    return (a.id || "").localeCompare(b.id || "");
                case "cultivo":
                    if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es");
                    return bFecha.localeCompare(aFecha, "es");
                case "parcela": {
                    const ao = minNumOrdenTratamiento(a);
                    const bo = minNumOrdenTratamiento(b);
                    if (ao !== bo) return ao - bo;
                    if (aParcela !== bParcela) return aParcela.localeCompare(bParcela, "es");
                    return aFecha.localeCompare(bFecha, "es");
                }
                case "producto":
                    if (aProd !== bProd) return aProd.localeCompare(bProd, "es");
                    return bFecha.localeCompare(aFecha, "es");
                case "fecha_desc":
                default:
                    if (bFecha !== aFecha) return bFecha.localeCompare(aFecha, "es");
                    return (a.id || "").localeCompare(b.id || "");
            }
        });
        return tratamientos;
    }, [cuaderno.tratamientos, tratSortMode, minNumOrdenTratamiento]);

    const parcelasFromSelectedTratamientos = useMemo(() => {
        if (selectedTratamientos.size === 0) return [];
        const tratamientos = (cuaderno.tratamientos || []) as any[];
        const ids = new Set<string>();
        for (const t of tratamientos) {
            if (t.id && selectedTratamientos.has(t.id) && Array.isArray(t.parcela_ids)) {
                for (const pid of t.parcela_ids) ids.add(pid);
            }
        }
        return Array.from(ids);
    }, [selectedTratamientos, cuaderno.tratamientos]);

    const tratamientosSummary = useMemo(() => {
        if (effectiveSheet !== "tratamientos") return null;
        const tratamientos = displayData as any[];
        const parseHa = (t: any) => parseFloat(t.superficie_tratada) || 0;
        const totalHa = tratamientos.reduce((sum: number, t: any) => sum + parseHa(t), 0);
        const selectedArr = tratamientos.filter((t: any) => t.id && selectedTratamientos.has(t.id));
        const selectedHa = selectedArr.reduce((sum: number, t: any) => sum + parseHa(t), 0);
        return {
            total: tratamientos.length,
            totalHa,
            selected: selectedArr.length,
            selectedHa,
        };
    }, [effectiveSheet, displayData, selectedTratamientos]);

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

    const toggleTratamientoSelection = useCallback((id: string) => {
        setSelectedTratamientos(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const toggleProductoSelection = useCallback((id: string) => {
        setSelectedProductos((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleFertilizacionSelection = useCallback((id: string) => {
        setSelectedFertilizaciones((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleCosechaSelection = useCallback((id: string) => {
        setSelectedCosechas((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAllRowSheet = useCallback(() => {
        const allIds = (displayData as any[]).map((r: any) => r.id).filter(Boolean);
        if (effectiveSheet === "parcelas") {
            setSelectedParcelas((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
        } else if (effectiveSheet === "tratamientos") {
            setSelectedTratamientos((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
        } else if (effectiveSheet === "productos") {
            setSelectedProductos((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
        } else if (effectiveSheet === "fertilizantes") {
            setSelectedFertilizaciones((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
        } else if (effectiveSheet === "cosecha") {
            setSelectedCosechas((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
        }
    }, [displayData, effectiveSheet]);

    const applyRowColorToSelection = useCallback(
        async (sheet: SheetType, ids: Set<string>, hex: string) => {
            if (ids.size === 0) return;
            const sheet_id = sheet === "cosecha" ? "cosecha" : sheet;
            const val = hex === "#ffffff" ? "" : hex;
            for (const id of ids) {
                await api.patchCell(cuaderno.id, { sheet_id, row: id, column: "color_fila", value: val });
            }
            onRefresh();
        },
        [cuaderno.id, onRefresh]
    );

    const sheetHasRowSelect = SHEETS_WITH_ROW_SELECT.includes(effectiveSheet);

    const currentRowSelectionCount = useMemo(() => {
        switch (effectiveSheet) {
            case "parcelas":
                return selectedParcelas.size;
            case "productos":
                return selectedProductos.size;
            case "tratamientos":
                return selectedTratamientos.size;
            case "fertilizantes":
                return selectedFertilizaciones.size;
            case "cosecha":
                return selectedCosechas.size;
            default:
                return 0;
        }
    }, [
        effectiveSheet,
        selectedParcelas,
        selectedProductos,
        selectedTratamientos,
        selectedFertilizaciones,
        selectedCosechas,
    ]);

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
        if (!BULK_EDIT_SHEETS.includes(effectiveSheet)) {
            alert("La edición masiva no está disponible en esta hoja.");
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

    const applyReplaceInSelection = useCallback(async () => {
        if (selectedCells.size === 0 || !buscarValue.trim()) return;
        if (!BULK_EDIT_SHEETS.includes(effectiveSheet)) return;
        const dataToUse = effectiveSheet === "parcelas" ? (displayData as any[]) : (data as any[]);
        setBulkApplying(true);
        setSaving(true);
        try {
            const updates: { rowId: string; colKey: string; newValue: string }[] = [];
            for (const key of selectedCells) {
                const [rStr, colKey] = key.split(":");
                const rowIndex = parseInt(rStr, 10);
                const row = dataToUse[rowIndex];
                const colCfg = config.columns.find((c) => c.key === colKey);
                if (!row?.id || !colKey || colCfg?.editable === false) continue;
                const currentVal = String((row as any)[colKey] ?? "").trim();
                if (!currentVal.includes(buscarValue)) continue;
                const newVal = currentVal.split(buscarValue).join(reemplazarValue);
                updates.push({ rowId: row.id, colKey, newValue: newVal });
            }
            for (const u of updates) {
                await api.patchCell(cuaderno.id, {
                    sheet_id: effectiveSheet,
                    row: u.rowId,
                    column: u.colKey,
                    value: u.newValue,
                });
            }
            if (updates.length > 0) {
                setLastSavedAt(Date.now());
                onRefresh();
                setSelectedCells(new Set());
                setSelectionAnchor(null);
                setBuscarValue("");
                setReemplazarValue("");
            }
        } catch (e) {
            console.error("Error en buscar/reemplazar:", e);
            alert("No se pudo aplicar.");
        } finally {
            setBulkApplying(false);
            setSaving(false);
        }
    }, [selectedCells, effectiveSheet, displayData, data, config.columns, cuaderno.id, buscarValue, reemplazarValue, onRefresh]);

    /** Pegar texto y asignar cada valor a su celda correspondiente (orden: fila por fila, columna por columna). */
    const applyPasteToSelection = useCallback(async () => {
        if (selectedCells.size === 0 || !pasteValues.trim() || !BULK_EDIT_SHEETS.includes(effectiveSheet)) return;
        const dataToUse = effectiveSheet === "parcelas" ? (displayData as any[]) : (data as any[]);
        const colOrder = config.columns.map((c) => c.key);

        // Ordenar celdas: por fila, luego por orden de columna
        const sorted = Array.from(selectedCells)
            .map((key) => {
                const [rStr, colKey] = key.split(":");
                const rowIndex = parseInt(rStr, 10);
                const colIdx = colOrder.indexOf(colKey);
                const colCfg = config.columns.find((c) => c.key === colKey);
                return { key, rowIndex, colIdx, colKey, editable: colCfg?.editable !== false };
            })
            .filter((x) => x.colIdx >= 0)
            .sort((a, b) => (a.rowIndex !== b.rowIndex ? a.rowIndex - b.rowIndex : a.colIdx - b.colIdx));

        // Parsear: líneas por filas, tab o coma por columnas
        const delim = pasteValues.includes("\t") ? "\t" : ",";
        const lines = pasteValues.trim().split(/\r?\n/).map((l) => l.split(delim).map((v) => v.trim()));
        const values = lines.flat();

        if (values.length === 0 || values.length !== sorted.length) {
            alert(`Has pegado ${values.length} valor(es) pero hay ${sorted.length} celda(s) seleccionadas. Deben coincidir.`);
            return;
        }

        setBulkApplying(true);
        setSaving(true);
        try {
            for (let i = 0; i < sorted.length; i++) {
                const { colKey, editable } = sorted[i];
                if (!editable) continue;
                const rowIndex = sorted[i].rowIndex;
                const row = dataToUse[rowIndex];
                if (!row?.id) continue;
                await api.patchCell(cuaderno.id, {
                    sheet_id: effectiveSheet,
                    row: row.id,
                    column: colKey,
                    value: values[i],
                });
            }
            setLastSavedAt(Date.now());
            onRefresh();
            setSelectedCells(new Set());
            setSelectionAnchor(null);
            setPasteValues("");
        } catch (e) {
            console.error("Error al aplicar pegada:", e);
            alert("No se pudo aplicar.");
        } finally {
            setBulkApplying(false);
            setSaving(false);
        }
    }, [selectedCells, effectiveSheet, displayData, data, config.columns, cuaderno.id, pasteValues, onRefresh]);

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
        if (type === "date" && value !== "") {
            return formatDateTableES(value);
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

    const buildExportParams = useCallback((params?: { desde?: string; hasta?: string }) => {
        return {
            ...params,
            orden_parcelas_modo: parcelSortMode,
            orden_parcelas: sortedParcelasForExport.map((p: any) => p.id).join(","),
            orden_tratamientos: sortedTratamientosForExport.map((t: any) => t.id).join(","),
            orden_tratamientos_modo: tratSortMode,
        };
    }, [parcelSortMode, tratSortMode, sortedParcelasForExport, sortedTratamientosForExport]);

    const _openSheetPicker = async (type: "pdf" | "excel", params?: { desde?: string; hasta?: string }) => {
        const baseParams = buildExportParams(params);
        try {
            const checkUrl = type === "pdf"
                ? api.getExportPDFUrl(cuaderno.id, { check_hojas_editadas: true, ...baseParams })
                : api.getExportExcelUrl(cuaderno.id, { check_hojas_editadas: true, ...baseParams });
            const checkRes = await fetch(checkUrl);
            const data = await checkRes.json();

            if (data?.hojas_editadas?.length > 0) {
                setExportHojasModal({
                    hojas: data.hojas_editadas,
                    type,
                    params: baseParams,
                });
                setSelectedExportHojas(new Set(data.hojas_editadas.map((h: any) => h.sheet_id)));
                return;
            }
        } catch (e) {
            console.error(`Error checking ${type} export sheets:`, e);
        }
        // Fallback: exportar directamente
        if (type === "pdf") {
            window.open(api.getExportPDFUrl(cuaderno.id, baseParams), "_blank");
        } else {
            api.downloadExportExcel(cuaderno.id, baseParams).catch(() =>
                window.open(api.getExportExcelUrl(cuaderno.id, baseParams), "_blank")
            );
        }
    };

    const exportPDF = (params?: { desde?: string; hasta?: string }) => _openSheetPicker("pdf", params);
    const exportExcel = (params?: { desde?: string; hasta?: string }) => _openSheetPicker("excel", params);

    const _doExport = (type: "pdf" | "excel", queryParams: Record<string, unknown>) => {
        if (type === "pdf") {
            window.open(api.getExportPDFUrl(cuaderno.id, queryParams), "_blank");
        } else {
            api.downloadExportExcel(cuaderno.id, queryParams).catch(() =>
                window.open(api.getExportExcelUrl(cuaderno.id, queryParams), "_blank")
            );
        }
    };

    const confirmExportHojas = () => {
        if (!exportHojasModal) return;
        const { type, params } = exportHojasModal;
        const freshOrder = buildExportParams({ desde: params.desde, hasta: params.hasta });
        _doExport(type, {
            ...params,
            ...freshOrder,
            incluir_hojas: selectedExportHojas.size > 0 ? Array.from(selectedExportHojas).join(",") : "",
        });
        setExportHojasModal(null);
    };


    const handleSaveCell = async (rowId: string, colKey: string, newValue: string) => {
        if (!BASE_EDITABLE_SHEETS.includes(effectiveSheet)) return;
        setEditingCell(null);
        let valueToSend: string | number = newValue;
        const colCfg = config.columns.find((c) => c.key === colKey);
        if (colCfg?.type === "date") {
            const iso = fechaFlexibleAISO(newValue);
            if (iso) valueToSend = iso;
        } else if (colCfg?.type === "number") {
            const n = parseDecimalInput(newValue);
            if (n !== null) valueToSend = n;
        }
        const payload = { sheet_id: effectiveSheet, row: rowId, column: colKey, value: valueToSend };
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

    const handleCopiarAParcelas = async () => {
        if (!copyToParcelsId || copyTargetParcelas.size === 0) return;
        setCopyingToParcels(true);
        try {
            const result = await api.copiarTratamientoAParcelas(cuaderno.id, copyToParcelsId, Array.from(copyTargetParcelas));
            setCopyToParcelsId(null);
            setCopyTargetParcelas(new Set());
            onRefresh();
            alert(result.message);
        } catch (e: any) {
            console.error(e);
            alert(e.message || "No se pudo copiar.");
        } finally {
            setCopyingToParcels(false);
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
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs transition-colors"
                            >
                                <ArrowLeft size={14} />
                                Volver al cuaderno
                            </button>
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs transition-colors"
                            >
                                <RefreshCw size={14} />
                                Cambiar hoja
                            </button>
                        </div>
                    </div>
                )}
                {/* Barra de búsqueda - hoja importada */}
                {searchOpen && (
                    <div className="h-12 px-4 flex items-center gap-3 border-b border-gray-200 bg-[var(--bg-dark)] shrink-0">
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
                            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-emerald-500/40"
                        />
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">
                            {searchQuery.trim() ? (searchResults.length > 0 ? `${searchActiveIndex + 1} / ${searchResults.length}` : "0 / 0") : "0 / 0"}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button type="button" onClick={goSearchPrev} disabled={searchResults.length === 0} className="p-2 rounded-md hover:bg-gray-100 text-gray-600 disabled:opacity-40"><ChevronUp size={16} /></button>
                            <button type="button" onClick={goSearchNext} disabled={searchResults.length === 0} className="p-2 rounded-md hover:bg-gray-100 text-gray-600 disabled:opacity-40"><ChevronDown size={16} /></button>
                        </div>
                        <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-2 rounded-md hover:bg-gray-100 text-gray-600"><X size={16} /></button>
                    </div>
                )}
                {/* Toolbar */}
                <div className="min-h-[48px] py-2 bg-[var(--bg-dark)] border-b border-gray-200 flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 electron-drag">
                    <div className="flex items-center gap-3">
                        <Table size={16} className="text-purple-400" />
                        <span className="font-medium text-sm text-gray-900">{hoja.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
                            Hoja importada (editable)
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 electron-no-drag shrink-0 ml-auto justify-end">
                        <span className="text-xs text-gray-500">
                            {hoja.datos?.length || 0} filas × {hoja.columnas?.length || 0} columnas
                        </span>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            onClick={() => exportPDF()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
                        >
                            <FileText size={14} />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            onClick={() => exportExcel()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
                        >
                            <FileSpreadsheet size={14} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
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
            <div className="h-10 bg-[var(--bg-dark)] border-t border-gray-200 flex items-center justify-between px-3 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-0.5">
                    {(["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha", "historico"] as SheetType[]).map((sheet) => (
                        <button
                            key={sheet}
                            onClick={() => handleSheetTabClick(sheet)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${effectiveImportedIndex === null && effectiveSheet === sheet
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            {SHEET_ICONS[sheet]}
                            {SHEET_CONFIG[sheet].title}
                        </button>
                    ))}

                    {hojas.length > 0 && (
                        <div className="w-px h-4 bg-gray-200 mx-2" />
                    )}

                    {hojas.map((hoja, idx) => (
                        <button
                            key={`imported_${idx}`}
                            onClick={() => handleImportedTabClick(idx)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${effectiveImportedIndex === idx
                                ? "bg-purple-500/10 text-purple-400"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            <Table size={12} />
                            {hoja.nombre.length > 15 ? `${hoja.nombre.slice(0, 15)}...` : hoja.nombre}
                        </button>
                    ))}
                </div>

                <span className="text-[11px] text-gray-500 shrink-0 ml-4">
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
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs transition-colors"
                            >
                                <ArrowLeft size={14} />
                                Volver al cuaderno
                            </button>
                            <button
                                onClick={onFocusModeExit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs transition-colors"
                            >
                                <RefreshCw size={14} />
                                Cambiar hoja
                            </button>
                        </div>
                    </div>
                )}
                {/* Toolbar — IDE: cuaderno, hoja activa, hints */}
                <div className="min-h-[48px] py-2 bg-[var(--bg-dark)] border-b border-gray-200 flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 electron-drag">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-sm text-gray-900 truncate">{cuaderno.nombre_explotacion}</span>
                        <span className="text-gray-500 text-xs">·</span>
                        <span className="text-xs text-gray-600 truncate" title="Hoja activa">
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
                        <span className="hidden sm:inline-flex items-center gap-2 text-[10px] text-gray-500 ml-2">
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300">⌘F</kbd> Buscar
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300">⌘K</kbd> Comandos
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 electron-no-drag shrink-0 ml-auto justify-end">
                        {/* Filtro por cultivo y tratamiento - solo en parcelas */}
                        {effectiveSheet === "parcelas" && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Filter size={14} className="text-gray-500 hidden sm:block" />
                                <select
                                    value={parcelaTratamientoFilter}
                                    onChange={(e) => { setParcelaTratamientoFilter(e.target.value as "" | "con_tratamiento" | "sin_tratamiento"); setSelectedParcelas(new Set()); }}
                                    className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500/40 min-w-[140px]"
                                    title="Filtrar parcelas con o sin tratamiento"
                                >
                                    <option value="">Todas las parcelas</option>
                                    <option value="sin_tratamiento">Sin tratamiento</option>
                                    <option value="con_tratamiento">Con tratamiento</option>
                                </select>
                                {uniqueCultivos.length > 0 && (
                                <select
                                    value={cultivoFilter}
                                    onChange={(e) => { setCultivoFilter(e.target.value); setSelectedParcelas(new Set()); }}
                                    className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500/40 min-w-[100px]"
                                >
                                    <option value="">Todos los cultivos</option>
                                    {uniqueCultivos.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                )}
                                <select
                                    value={parcelSortMode}
                                    onChange={(e) => setParcelSortMode(e.target.value as ParcelSortMode)}
                                    className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500/40 min-w-[180px]"
                                >
                                    <option value="num_orden">Orden: Original / IA</option>
                                    <option value="todo_az">Orden: Todo A-Z</option>
                                    <option value="cultivo_superficie">Orden: cultivo + superficie</option>
                                    <option value="cultivo">Orden: por cultivo (A-Z)</option>
                                    <option value="alfabetico">Orden: por nombre (A-Z)</option>
                                    <option value="termino_municipal">Orden: por término municipal (A-Z)</option>
                                    <option value="superficie_desc">Orden: por superficie (mayor primero)</option>
                                    <option value="superficie_asc">Orden: por superficie (menor primero)</option>
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={targetHectareas}
                                    onChange={(e) => setTargetHectareas(e.target.value)}
                                    placeholder="ha objetivo"
                                    className="w-24 rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 placeholder-gray-500 focus:outline-none focus:border-emerald-500/40"
                                />
                                <button
                                    type="button"
                                    onClick={autoSelectByHectareas}
                                    className="px-2.5 py-1.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs transition-colors whitespace-nowrap"
                                >
                                    Auto-seleccionar ha
                                </button>
                                <div className="w-px h-5 bg-gray-200" />
                            </div>
                        )}
                        {effectiveSheet === "tratamientos" && uniqueCultivosTrat.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Filter size={14} className="text-gray-500 hidden sm:block" />
                                <select
                                    value={tratCultivoFilter}
                                    onChange={(e) => { setTratCultivoFilter(e.target.value); setSelectedTratamientos(new Set()); }}
                                    className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500/40 min-w-[100px]"
                                >
                                    <option value="">Todos los cultivos</option>
                                    {uniqueCultivosTrat.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <select
                                    value={tratSortMode}
                                    onChange={(e) => setTratSortMode(e.target.value as TratSortMode)}
                                    className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500/40 min-w-[160px]"
                                >
                                    <option value="fecha_desc">Orden: Fecha (reciente primero)</option>
                                    <option value="fecha_asc">Orden: Fecha (antiguo primero)</option>
                                    <option value="cultivo">Orden: por cultivo</option>
                                    <option value="parcela">Orden: parcela (Nº orden SIGPAC)</option>
                                    <option value="producto">Orden: por producto</option>
                                </select>
                                <div className="w-px h-5 bg-gray-200" />
                            </div>
                        )}
                        {effectiveSheet !== "historico" && (
                            <>
                                <button
                                    onClick={() => {
                                        setOpenTreatFromSelection(false);
                                        setOpenTreatFromTratSelection(false);
                                        setOpenFertFromSelection(false);
                                        setShowAddModal(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors ml-auto sm:ml-0"
                                >
                                    <Plus size={14} />
                                    Añadir
                                </button>
                                {["productos", "fertilizantes", "cosecha"].includes(effectiveSheet) && (
                                    <button
                                        onClick={() => setShowBulkModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 text-xs font-medium transition-colors"
                                    >
                                        <Table2 size={14} />
                                        Añadir varios
                                    </button>
                                )}
                            </>
                        )}
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            onClick={() => exportPDF(
                                effectiveSheet === "historico"
                                    ? { desde: historicoFilters.date_from, hasta: historicoFilters.date_to }
                                    : undefined
                            )}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
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
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
                        >
                            <FileSpreadsheet size={14} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 text-xs transition-colors"
                            title="Buscar en hoja (⌘F / Ctrl+F)"
                        >
                            <Search size={14} />
                        </button>
                    </div>
                </div>

                {/* Barra de búsqueda */}
                {searchOpen && (
                    <div className="h-12 px-4 flex items-center gap-3 border-b border-gray-200 bg-[var(--bg-dark)] shrink-0">
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
                            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-emerald-500/40"
                        />
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">
                            {searchQuery.trim() ? (searchResults.length > 0 ? `${searchActiveIndex + 1} / ${searchResults.length}` : "0 / 0") : "0 / 0"}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={goSearchPrev}
                                disabled={searchResults.length === 0}
                                className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Anterior (Shift+Enter)"
                            >
                                <ChevronUp size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={goSearchNext}
                                disabled={searchResults.length === 0}
                                className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Siguiente (Enter)"
                            >
                                <ChevronDown size={16} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800"
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Filtros histórico */}
                {effectiveSheet === "historico" && (
                    <div className="px-4 py-2 border-b border-gray-200 bg-[var(--bg-dark)] flex flex-wrap items-center gap-3">
                        <span className="text-xs text-gray-500">Filtros:</span>
                        <select
                            value={historicoFilters.parcela_id || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, parcela_id: e.target.value || undefined }))}
                            className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
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
                            className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                            placeholder="Desde"
                        />
                        <input
                            type="date"
                            value={historicoFilters.date_to || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
                            className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                            placeholder="Hasta"
                        />
                        <select
                            value={historicoFilters.product_id || ""}
                            onChange={(e) => setHistoricoFilters((f) => ({ ...f, product_id: e.target.value || undefined }))}
                            className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
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
                            className="rounded-md bg-gray-100 border border-gray-300 px-2 py-1.5 text-xs text-gray-800 w-28"
                        />
                    </div>
                )}

                {/* Barra sumatorio hectáreas */}
                {effectiveSheet === "parcelas" && hectareasSummary && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-emerald-400" />
                                <span className="text-xs text-gray-600">Total:</span>
                                <span className="text-sm font-semibold text-gray-900">{hectareasSummary.total} parcelas</span>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-sm font-semibold text-emerald-400">{Number(hectareasSummary.totalHa || 0).toFixed(2)} ha</span>
                            </div>
                            {hectareasSummary.selected > 0 && (
                                <>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <div className="flex items-center gap-2">
                                        <CheckSquare size={14} className="text-blue-400" />
                                        <span className="text-xs text-gray-600">Seleccionadas:</span>
                                        <span className="text-sm font-semibold text-blue-400">{hectareasSummary.selected} parcelas</span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-sm font-bold text-blue-300">{Number(hectareasSummary.selectedHa || 0).toFixed(2)} ha</span>
                                    </div>
                                </>
                            )}
                        </div>
                        {hectareasSummary.selected > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1" title="Color de fila">
                                    <Palette size={14} className="text-gray-500" />
                                    {ROW_COLOR_SWATCHES.map((hex) => (
                                        <button
                                            key={hex}
                                            type="button"
                                            onClick={() => applyRowColorToSelection("parcelas", selectedParcelas, hex)}
                                            className={`w-5 h-5 rounded border-2 transition-all ${hex === "#ffffff" ? "border-gray-300" : "border-transparent"} hover:scale-110 hover:ring-2 hover:ring-gray-400`}
                                            style={{ backgroundColor: hex }}
                                            title={hex === "#ffffff" ? "Blanco (sin color)" : `Color ${hex}`}
                                        />
                                    ))}
                                </div>
                                <div className="w-px h-5 bg-gray-200 hidden sm:block" />
                                <button
                                    onClick={() => { setOpenTreatFromSelection(true); setOpenFertFromSelection(false); setShowAddModal(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                                >
                                    <Plus size={13} />
                                    Añadir tratamiento
                                </button>
                                <button
                                    onClick={() => { setOpenFertFromSelection(true); setOpenTreatFromSelection(false); setShowAddModal(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                                >
                                    <Plus size={13} />
                                    Añadir fertilizante
                                </button>
                                <button
                                    onClick={sendParcelaCheckboxesToChat}
                                    disabled={!onSendSelectionToChat}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs transition-colors disabled:opacity-50"
                                >
                                    <Send size={13} />
                                    Chat IA
                                </button>
                                <button
                                    onClick={() => setSelectedParcelas(new Set())}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Barra selección tratamientos */}
                {effectiveSheet === "tratamientos" && tratamientosSummary && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-blue-500/5 to-transparent flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <ClipboardList size={14} className="text-blue-400" />
                                <span className="text-xs text-gray-600">Total:</span>
                                <span className="text-sm font-semibold text-gray-900">{tratamientosSummary.total} tratamientos</span>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-sm font-semibold text-emerald-400">{Number(tratamientosSummary.totalHa || 0).toFixed(2)} ha</span>
                            </div>
                            {tratamientosSummary.selected > 0 && (
                                <>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <div className="flex items-center gap-2">
                                        <CheckSquare size={14} className="text-blue-400" />
                                        <span className="text-xs text-gray-600">Seleccionados:</span>
                                        <span className="text-sm font-semibold text-blue-400">{tratamientosSummary.selected} tratamiento(s)</span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-sm font-bold text-blue-300">{Number(tratamientosSummary.selectedHa || 0).toFixed(2)} ha</span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-sm text-blue-300">{parcelasFromSelectedTratamientos.length} parcela(s)</span>
                                    </div>
                                </>
                            )}
                        </div>
                        {tratamientosSummary.selected > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1" title="Color de fila">
                                    <Palette size={14} className="text-gray-500" />
                                    {ROW_COLOR_SWATCHES.map((hex) => (
                                        <button
                                            key={hex}
                                            type="button"
                                            onClick={() => applyRowColorToSelection("tratamientos", selectedTratamientos, hex)}
                                            className={`w-5 h-5 rounded border-2 transition-all ${hex === "#ffffff" ? "border-gray-300" : "border-transparent"} hover:scale-110 hover:ring-2 hover:ring-gray-400`}
                                            style={{ backgroundColor: hex }}
                                            title={hex === "#ffffff" ? "Blanco (sin color)" : `Color ${hex}`}
                                        />
                                    ))}
                                </div>
                                <div className="w-px h-5 bg-gray-200" />
                                <button
                                    onClick={() => { setOpenTreatFromTratSelection(true); setShowAddModal(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                                >
                                    <Plus size={13} />
                                    Añadir tratamiento
                                </button>
                                <button
                                    onClick={() => setSelectedTratamientos(new Set())}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {effectiveSheet === "productos" && currentRowSelectionCount > 0 && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-amber-500/5 to-transparent flex items-center justify-between shrink-0">
                        <span className="text-sm text-gray-700">{currentRowSelectionCount} producto(s) seleccionado(s)</span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1" title="Color de fila">
                                <Palette size={14} className="text-gray-500" />
                                {ROW_COLOR_SWATCHES.map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => applyRowColorToSelection("productos", selectedProductos, hex)}
                                        className={`w-5 h-5 rounded border-2 transition-all ${hex === "#ffffff" ? "border-gray-300" : "border-transparent"} hover:scale-110 hover:ring-2 hover:ring-gray-400`}
                                        style={{ backgroundColor: hex }}
                                        title={hex === "#ffffff" ? "Blanco (sin color)" : `Color ${hex}`}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedProductos(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}

                {effectiveSheet === "fertilizantes" && currentRowSelectionCount > 0 && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-lime-500/5 to-transparent flex items-center justify-between shrink-0">
                        <span className="text-sm text-gray-700">{currentRowSelectionCount} registro(s) seleccionado(s)</span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1" title="Color de fila">
                                <Palette size={14} className="text-gray-500" />
                                {ROW_COLOR_SWATCHES.map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => applyRowColorToSelection("fertilizantes", selectedFertilizaciones, hex)}
                                        className={`w-5 h-5 rounded border-2 transition-all ${hex === "#ffffff" ? "border-gray-300" : "border-transparent"} hover:scale-110 hover:ring-2 hover:ring-gray-400`}
                                        style={{ backgroundColor: hex }}
                                        title={hex === "#ffffff" ? "Blanco (sin color)" : `Color ${hex}`}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedFertilizaciones(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}

                {effectiveSheet === "cosecha" && currentRowSelectionCount > 0 && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-yellow-500/5 to-transparent flex items-center justify-between shrink-0">
                        <span className="text-sm text-gray-700">{currentRowSelectionCount} registro(s) seleccionado(s)</span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1" title="Color de fila">
                                <Palette size={14} className="text-gray-500" />
                                {ROW_COLOR_SWATCHES.map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => applyRowColorToSelection("cosecha", selectedCosechas, hex)}
                                        className={`w-5 h-5 rounded border-2 transition-all ${hex === "#ffffff" ? "border-gray-300" : "border-transparent"} hover:scale-110 hover:ring-2 hover:ring-gray-400`}
                                        style={{ backgroundColor: hex }}
                                        title={hex === "#ffffff" ? "Blanco (sin color)" : `Color ${hex}`}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCosechas(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}

                {/* Spreadsheet */}
                <div className="flex-1 overflow-auto bg-[var(--bg-darker)]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[var(--bg-dark)]">
                                            {sheetHasRowSelect && (
                                                <th className="w-10 px-2 py-2.5 text-center border-b border-r border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={toggleSelectAllRowSheet}
                                                        className="text-gray-500 hover:text-emerald-400 transition-colors"
                                                        title="Seleccionar todo"
                                                    >
                                                        {(() => {
                                                            const n = (displayData as any[]).filter((r: any) => r.id).length;
                                                            const allOn = n > 0 && currentRowSelectionCount === n;
                                                            return allOn ? <CheckSquare size={15} className="text-emerald-400" /> : <Square size={15} />;
                                                        })()}
                                                    </button>
                                                </th>
                                            )}
                                <th className="w-12 px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                                    onClick={() => clearCellSelection()}
                                    title="Limpiar selección de celdas"
                                >
                                    #
                                </th>
                                {config.columns.map((col, colIdx) => (
                                    <th
                                        key={col.key}
                                        style={{ width: col.width }}
                                        className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none"
                                        onClick={() => handleSelectColumn(colIdx)}
                                        title={`Seleccionar columna "${col.label}"`}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th className="w-24 px-3 py-2.5 text-center text-[11px] font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">

                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={config.columns.length + (sheetHasRowSelect ? 3 : 2)}
                                        className="px-8 py-16 text-center text-gray-500"
                                    >
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                                                {SHEET_ICONS[effectiveSheet]}
                                            </div>
                                            <p>{(effectiveSheet === "parcelas" && cultivoFilter) ? `Sin parcelas con cultivo "${cultivoFilter}"` : (effectiveSheet === "parcelas" && parcelaTratamientoFilter === "sin_tratamiento") ? "¡Todas las parcelas tienen tratamiento!" : (effectiveSheet === "parcelas" && parcelaTratamientoFilter === "con_tratamiento") ? "Ninguna parcela tiene tratamiento aún" : (effectiveSheet === "tratamientos" && tratCultivoFilter) ? `Sin tratamientos con cultivo "${tratCultivoFilter}"` : `Sin datos en ${config.title.toLowerCase()}`}</p>
                                            {effectiveSheet !== "historico" && !cultivoFilter && !parcelaTratamientoFilter && (
                                                <button
                                                    onClick={() => setShowAddModal(true)}
                                                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                                                >
                                                    <Plus size={16} />
                                                    Añadir {effectiveSheet === "parcelas" ? "parcela" : effectiveSheet === "productos" ? "producto" : effectiveSheet === "fertilizantes" ? "fertilizante" : effectiveSheet === "cosecha" ? "cosecha" : "tratamiento"}
                                                </button>
                                            )}
                                            {(cultivoFilter || tratCultivoFilter || parcelaTratamientoFilter) && (
                                                <button
                                                    onClick={() => { setCultivoFilter(""); setTratCultivoFilter(""); setParcelaTratamientoFilter(""); }}
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
                                    const isRowSheetSelected =
                                        (effectiveSheet === "parcelas" && selectedParcelas.has(row.id)) ||
                                        (effectiveSheet === "productos" && selectedProductos.has(row.id)) ||
                                        (effectiveSheet === "tratamientos" && selectedTratamientos.has(row.id)) ||
                                        (effectiveSheet === "fertilizantes" && selectedFertilizaciones.has(row.id)) ||
                                        (effectiveSheet === "cosecha" && selectedCosechas.has(row.id));

                                    // Separador de parcela cuando tratamientos ordenados por parcela
                                    const showParcelaSeparator = effectiveSheet === "tratamientos" && tratSortMode === "parcela";
                                    const parcelaKey = (r: any) => {
                                        const val = r?.parcela_nombres ?? r?.num_orden_parcelas ?? "";
                                        return (Array.isArray(val) ? (val as string[]).join(",") : String(val)).toLowerCase();
                                    };
                                    const prevRow = idx > 0 ? (displayData as any[])[idx - 1] : null;
                                    const isNewParcela = !prevRow || parcelaKey(row) !== parcelaKey(prevRow);
                                    const parcelaLabel = Array.isArray(row.parcela_nombres) && row.parcela_nombres.length
                                        ? (row.parcela_nombres as string[]).join(", ")
                                        : (row.num_orden_parcelas ? `Ord. ${row.num_orden_parcelas}` : "-");

                                    const colspan = config.columns.length + (sheetHasRowSelect ? 3 : 2);

                                    return (
                                        <Fragment key={row.id || idx}>
                                            {showParcelaSeparator && isNewParcela && (
                                                <tr className="parcela-separator">
                                                    <td
                                                        colSpan={colspan}
                                                        className="px-4 py-2 bg-emerald-500/10 border-b-2 border-emerald-500/30 text-emerald-700 font-semibold text-sm sticky left-0"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <MapPin size={14} className="text-emerald-600 shrink-0" />
                                                            {parcelaLabel}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )}
                                        <tr
                                            key={row.id || idx}
                                            className={`group transition-colors ${!row.color_fila ? "hover:bg-gray-50" : "hover:brightness-95"} ${isHighlighted ? "ring-1 ring-emerald-500/50" : ""} ${isRowSheetSelected ? "ring-1 ring-blue-500/40" : ""}`}
                                            style={sheetHasRowSelect && row.color_fila
                                                ? { backgroundColor: row.color_fila }
                                                : undefined}
                                        >
                                            {sheetHasRowSelect && (
                                                <td className="px-2 py-2 text-center border-b border-r border-gray-200 bg-[var(--bg-dark)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (effectiveSheet === "parcelas") toggleParcelaSelection(row.id);
                                                            else if (effectiveSheet === "productos") toggleProductoSelection(row.id);
                                                            else if (effectiveSheet === "tratamientos") toggleTratamientoSelection(row.id);
                                                            else if (effectiveSheet === "fertilizantes") toggleFertilizacionSelection(row.id);
                                                            else if (effectiveSheet === "cosecha") toggleCosechaSelection(row.id);
                                                        }}
                                                        className="text-gray-500 hover:text-emerald-400 transition-colors"
                                                    >
                                                        {isRowSheetSelected
                                                            ? <CheckSquare size={15} className="text-blue-400" />
                                                            : <Square size={15} />
                                                        }
                                                    </button>
                                                </td>
                                            )}
                                            <td
                                                className="px-3 py-2 text-gray-500 text-xs font-mono border-b border-r border-gray-200 bg-[var(--bg-dark)] cursor-pointer hover:bg-gray-100 select-none"
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
                                                                    className="p-1 rounded-md bg-gray-100 opacity-0 group-hover/link:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 focus:opacity-100 transition-all text-gray-600 shrink-0"
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
                                                        className={`px-3 py-2 text-gray-700 border-b border-r border-gray-200 cursor-pointer select-none transition-colors ${isCellSelected
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
                                                                    : "bg-gray-200 text-gray-600"
                                                                }`}>
                                                                {raw || "-"}
                                                            </span>
                                                        ) : isEditing ? (
                                                            <input
                                                                autoFocus
                                                                className="w-full min-w-[80px] px-2 py-1 rounded bg-gray-200 border border-emerald-500/50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                                                            <span className={`block w-full text-left min-h-[28px] rounded px-1 -mx-1 ${isBaseSheetEditable && row.id ? "hover:bg-gray-100" : ""}`}>
                                                                {display}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 border-b border-gray-200">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {effectiveSheet === "tratamientos" && row.id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowTratamientoDetalleId(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-emerald-400"
                                                                title="Ver parcelas"
                                                            >
                                                                <MapPin size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditTratamientoId(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setCopyToParcelsId(row.id); setCopyTargetParcelas(new Set()); }}
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-blue-400"
                                                                title="Copiar a otras parcelas"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTratamiento(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400"
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
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-amber-400"
                                                                title="Ver tratamientos previos"
                                                            >
                                                                <History size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onRequestHighlight?.(effectiveSheet, row.id)}
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                                                                title="Ver"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteParcela(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400"
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
                                                                className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                                                                title="Ver"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteProducto(row.id)}
                                                                className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        </Fragment>
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
                                <span className="text-xs text-gray-600">Selección:</span>
                                <span className="text-sm font-semibold text-blue-300">{selectedCells.size} celda{selectedCells.size !== 1 ? "s" : ""}</span>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-xs text-gray-600">
                                    {(() => {
                                        const rows = new Set<number>();
                                        for (const key of selectedCells) rows.add(parseInt(key.split(":")[0]));
                                        return `${rows.size} fila${rows.size !== 1 ? "s" : ""}`;
                                    })()}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {BULK_EDIT_SHEETS.includes(effectiveSheet) && (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={bulkEditValue}
                                            onChange={(e) => setBulkEditValue(e.target.value)}
                                            placeholder="Nuevo valor para todas"
                                            className="w-40 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                        />
                                        <button
                                            onClick={applyBulkEditToSelection}
                                            disabled={bulkApplying}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {bulkApplying ? "..." : "Aplicar"}
                                        </button>
                                    </div>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <div className="flex items-center gap-1.5">
                                        <textarea
                                            value={pasteValues}
                                            onChange={(e) => setPasteValues(e.target.value)}
                                            placeholder="Pegar texto (tab o coma entre columnas, Enter entre filas)"
                                            rows={1}
                                            className="w-56 min-h-[32px] max-h-20 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50 resize-y"
                                        />
                                        <button
                                            onClick={applyPasteToSelection}
                                            disabled={bulkApplying || !pasteValues.trim()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                        >
                                            {bulkApplying ? "..." : "Asignar"}
                                        </button>
                                    </div>
                                    <div className="w-px h-5 bg-gray-200" />
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={buscarValue}
                                            onChange={(e) => setBuscarValue(e.target.value)}
                                            placeholder="Buscar"
                                            className="w-28 px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                        />
                                        <span className="text-gray-500 text-xs">→</span>
                                        <input
                                            type="text"
                                            value={reemplazarValue}
                                            onChange={(e) => setReemplazarValue(e.target.value)}
                                            placeholder="Reemplazar"
                                            className="w-28 px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                        />
                                        <button
                                            onClick={applyReplaceInSelection}
                                            disabled={bulkApplying || !buscarValue.trim()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {bulkApplying ? "..." : "Reemplazar"}
                                        </button>
                                    </div>
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
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 text-xs transition-colors"
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
            <AddBulkModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                sheet={effectiveSheet}
                cuaderno={cuaderno}
                onSuccess={onRefresh}
            />
            <AddRowModal
                isOpen={showAddModal || !!editTratamientoId}
                onClose={() => { setShowAddModal(false); setEditTratamientoId(null); setOpenTreatFromSelection(false); setOpenTreatFromTratSelection(false); setOpenFertFromSelection(false); }}
                sheet={openTreatFromSelection || openTreatFromTratSelection ? "tratamientos" : openFertFromSelection ? "fertilizantes" : effectiveSheet}
                cuaderno={cuaderno}
                editTratamientoId={editTratamientoId ?? undefined}
                initialParcelaIds={openTreatFromTratSelection ? parcelasFromSelectedTratamientos : ((openTreatFromSelection || openFertFromSelection) ? Array.from(selectedParcelas) : [])}
                onSuccess={() => {
                    setShowAddModal(false);
                    setEditTratamientoId(null);
                    setOpenTreatFromSelection(false);
                    setOpenTreatFromTratSelection(false);
                    setOpenFertFromSelection(false);
                    setSelectedParcelas(new Set());
                    setSelectedTratamientos(new Set());
                    onRefresh();
                }}
            />

            {/* Modal Tratamientos Previos de Parcela */}
            {showTratamientosParcelaId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTratamientosParcelaId(null)} />
                    <div className="relative bg-[var(--bg-dark)] border border-gray-300 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <History size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Tratamientos Previos</h3>
                                    <p className="text-xs text-gray-500">
                                        {(() => {
                                            const p = (cuaderno.parcelas || []).find((p: any) => p.id === showTratamientosParcelaId);
                                            return p ? `${p.nombre || p.especie || 'Parcela'} — ${p.superficie_cultivada || p.superficie_ha || 0} ha` : 'Parcela';
                                        })()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTratamientosParcelaId(null)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingTratamientos ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="ml-3 text-sm text-gray-500">Cargando tratamientos...</span>
                                </div>
                            ) : parcelaTratamientos.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 mx-auto mb-3">
                                        <ClipboardList size={24} />
                                    </div>
                                    <p className="text-sm text-gray-600">Sin tratamientos registrados para esta parcela</p>
                                    <p className="text-xs text-gray-600 mt-1">Los tratamientos aparecerán aquí cuando se registren</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {parcelaTratamientos.map((t: any, index: number) => (
                                        <div key={t.id || index} className="rounded-xl bg-gray-50 border border-gray-200 p-4 hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                        {t.fecha_aplicacion ? formatDateTableES(t.fecha_aplicacion) : '-'}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${t.estado === 'aplicado' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        t.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-gray-200 text-gray-600'
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
                                                <div><span className="text-gray-500">Problema:</span> <span className="text-gray-700">{t.problema_fitosanitario || t.plaga_enfermedad || '-'}</span></div>
                                                <div><span className="text-gray-500">Superficie:</span> <span className="text-gray-700">{t.superficie_tratada || 0} ha</span></div>
                                                {t.productos && t.productos.length > 0 && (
                                                    <div className="col-span-2 mt-1">
                                                        <span className="text-gray-500">Productos:</span>
                                                        <div className="mt-1 space-y-0.5">
                                                            {t.productos.map((p: any, pi: number) => (
                                                                <div key={pi} className="flex items-center gap-2 text-gray-700 pl-2 border-l-2 border-emerald-500/30 flex-wrap">
                                                                    <span className="font-medium">{p.nombre_comercial}</span>
                                                                    {(p.problema_fitosanitario || p.plaga_enfermedad) && (
                                                                        <span className="text-[11px] text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                                            {p.problema_fitosanitario || p.plaga_enfermedad}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-gray-500">—</span>
                                                                    <span>{p.dosis} {p.unidad_dosis}</span>
                                                                    {p.numero_registro && <span className="text-gray-600">({p.numero_registro})</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {t.operador && <div><span className="text-gray-500">Operador:</span> <span className="text-gray-700">{t.operador}</span></div>}
                                                {t.observaciones && <div className="col-span-2"><span className="text-gray-500">Notas:</span> <span className="text-gray-700">{t.observaciones}</span></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-100 shrink-0">
                            <span className="text-xs text-gray-500">{parcelaTratamientos.length} tratamiento(s)</span>
                            <button
                                onClick={() => setShowTratamientosParcelaId(null)}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 hover:text-gray-900 transition-colors"
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
                        <div className="relative bg-[var(--bg-dark)] border border-gray-300 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <MapPin size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">Parcelas del Tratamiento</h3>
                                        <p className="text-xs text-gray-500">
                                            {t?.fecha_aplicacion ? formatDateTableES(t.fecha_aplicacion) : ''} • {Number(t?.superficie_tratada || 0).toFixed(2)} ha totales
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowTratamientoDetalleId(null)}
                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 max-h-[60vh]">
                                {relatedParcelas.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-gray-600">No se encontraron parcelas vinculadas a este tratamiento.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {relatedParcelas.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors gap-3">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-gray-800">{p.nombre || 'Sin nombre'}</span>
                                                        {p.num_orden ? (
                                                            <span className="text-[10px] font-mono text-gray-600 bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded">
                                                                Nº {p.num_orden}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">
                                                        {p.num_poligono && p.num_parcela
                                                            ? `Pol ${p.num_poligono} • Parc ${p.num_parcela} • Rec ${p.num_recinto || '-'}`
                                                            : 'Sin datos SIGPAC'}
                                                        {p.termino_municipal && ` • ${p.termino_municipal}`}
                                                    </div>
                                                </div>
                                                <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-gray-200 sm:border-t-0">
                                                    <div className="text-sm font-bold text-emerald-400">
                                                        {Number(p.superficie_cultivada || p.superficie_ha || p.superficie_sigpac || 0).toFixed(2)} ha
                                                    </div>
                                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {p.cultivo || p.especie || 'Sin cultivo'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-100 shrink-0">
                                <span className="text-xs text-gray-500">{relatedParcelas.length} parcela(s) vinculadas</span>
                                <button
                                    onClick={() => setShowTratamientoDetalleId(null)}
                                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal: Copiar tratamiento a otras parcelas */}
            {copyToParcelsId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCopyToParcelsId(null)} />
                    <div className="relative bg-[var(--bg-dark)] border border-gray-300 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">Copiar tratamiento a otras parcelas</h3>
                                <p className="text-xs text-gray-500">Selecciona las parcelas destino. Se creará 1 línea por parcela.</p>
                            </div>
                            <button onClick={() => setCopyToParcelsId(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 max-h-[50vh] space-y-1">
                            {(cuaderno.parcelas || [])
                                .sort((a: any, b: any) => (a.num_orden || 999) - (b.num_orden || 999))
                                .map((p: any) => {
                                    const checked = copyTargetParcelas.has(p.id);
                                    return (
                                        <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const next = new Set(copyTargetParcelas);
                                                    checked ? next.delete(p.id) : next.add(p.id);
                                                    setCopyTargetParcelas(next);
                                                }}
                                                className="accent-blue-500"
                                            />
                                            <span className="text-xs font-mono text-gray-600 w-8">{p.num_orden || "-"}</span>
                                            <span className="text-sm text-gray-800 flex-1">{p.nombre || "Sin nombre"}</span>
                                            <span className="text-xs text-gray-500">{(p.especie || p.cultivo || "").toUpperCase()}</span>
                                            <span className="text-xs text-emerald-400 font-medium">{Number(p.superficie_cultivada || p.superficie_ha || 0).toFixed(2)} ha</span>
                                        </label>
                                    );
                                })}
                        </div>
                        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-100 shrink-0">
                            <span className="text-xs text-gray-500">{copyTargetParcelas.size} parcela(s) seleccionada(s)</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCopyToParcelsId(null)}
                                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCopiarAParcelas}
                                    disabled={copyTargetParcelas.size === 0 || copyingToParcels}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
                                >
                                    {copyingToParcels ? "Copiando..." : "Copiar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Seleccionar hojas para exportar */}
            {exportHojasModal && (() => {
                const hojasBase = exportHojasModal.hojas.filter((h: any) => h.tipo === "base");
                const hojasImp = exportHojasModal.hojas.filter((h: any) => h.tipo === "importada");
                const renderHoja = (h: any) => {
                    const checked = selectedExportHojas.has(h.sheet_id);
                    return (
                        <label key={h.sheet_id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                    const next = new Set(selectedExportHojas);
                                    checked ? next.delete(h.sheet_id) : next.add(h.sheet_id);
                                    setSelectedExportHojas(next);
                                }}
                                className="accent-emerald-500"
                            />
                            <span className="text-sm text-gray-800 flex-1">{h.nombre || h.sheet_id}</span>
                            <span className="text-xs text-gray-500">{h.num_filas || 0} filas</span>
                        </label>
                    );
                };
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExportHojasModal(null)} />
                        <div className="relative bg-[var(--bg-dark)] border border-gray-300 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Exportar {exportHojasModal.type === "pdf" ? "PDF" : "Excel"}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Selecciona las hojas que quieres incluir en la exportación.
                                    </p>
                                </div>
                                <button onClick={() => setExportHojasModal(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 max-h-[50vh] space-y-1">
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedExportHojas(new Set(exportHojasModal.hojas.map((h: any) => h.sheet_id)))}
                                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedExportHojas(new Set())}
                                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    >
                                        Ninguna
                                    </button>
                                </div>
                                {hojasBase.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 pt-1 pb-1">Hojas del editor</p>
                                        {hojasBase.map(renderHoja)}
                                    </>
                                )}
                                {hojasImp.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 pt-3 pb-1">Hojas importadas</p>
                                        {hojasImp.map(renderHoja)}
                                    </>
                                )}
                            </div>
                            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-100 shrink-0">
                                <span className="text-xs text-gray-500">{selectedExportHojas.size} de {exportHojasModal.hojas.length} hoja(s)</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setExportHojasModal(null)}
                                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmExportHojas}
                                        disabled={selectedExportHojas.size === 0}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
                                    >
                                        Exportar ({selectedExportHojas.size})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
