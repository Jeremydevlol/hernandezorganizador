"use client";

import { useState, useEffect, useCallback } from "react";
import { HojaExcel, CellSelection } from "@/lib/types";
import { Save, X, FileSpreadsheet, Plus, Trash2, Edit3, Send, Table2 } from "lucide-react";

type SearchMatch = { rowIndex: number; colKey: string | number };

interface ImportedSheetProps {
    hoja: HojaExcel;
    onSave: (patch: { datos?: any[][]; columnas?: string[]; nombre?: string }) => Promise<void>;
    /** Si se pasa, las ediciones de celda se persisten por delta (PATCH cell), no enviando la hoja entera. */
    onPatchCell?: (row: number, col: number, value: any) => Promise<void>;
    onDelete: () => Promise<void>;
    onRename?: (newName: string) => Promise<void>;
    /** Resultados de búsqueda para resaltar celdas. */
    searchResults?: SearchMatch[];
    searchActiveIndex?: number;
    /** Callback para enviar selección de celdas al chat */
    onSendSelectionToChat?: (selection: CellSelection) => void;
}

export default function ImportedSheet({ hoja, onSave, onPatchCell, onDelete, onRename, searchResults = [], searchActiveIndex = 0, onSendSelectionToChat }: ImportedSheetProps) {
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [localData, setLocalData] = useState(hoja.datos || []);
    const [localColumnas, setLocalColumnas] = useState(hoja.columnas || []);
    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [editColValue, setEditColValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [isRenamingSheet, setIsRenamingSheet] = useState(false);
    const [sheetNameValue, setSheetNameValue] = useState(hoja.nombre || "");

    // ---- Cell Selection State ----
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [selectionAnchor, setSelectionAnchor] = useState<{ rowIdx: number; colIdx: number } | null>(null);
    const [bulkEditValue, setBulkEditValue] = useState("");
    const [pasteValues, setPasteValues] = useState("");
    const [buscarValue, setBuscarValue] = useState("");
    const [reemplazarValue, setReemplazarValue] = useState("");
    const [bulkApplying, setBulkApplying] = useState(false);

    useEffect(() => {
        setLocalData(hoja.datos || []);
        setLocalColumnas(hoja.columnas || []);
    }, [hoja.sheet_id, hoja.datos, hoja.columnas]);

    // Clear selection when sheet changes
    useEffect(() => {
        setSelectedCells(new Set());
        setSelectionAnchor(null);
    }, [hoja.sheet_id]);

    const docName = hoja.nombre || "Documento";
    const columns = localColumnas.length > 0
        ? localColumnas
        : (localData[0] || []).map((_: any, i: number) => `${docName} - Columna ${i + 1}`);
    const displayData = localData;
    const numCols = Math.max(columns.length, ...displayData.map((r: any) => (r || []).length));

    // ---- Cell Selection ----
    const handleCellClick = useCallback((rowIdx: number, colIdx: number, e: React.MouseEvent) => {
        const key = `${rowIdx}:${colIdx}`;

        if (e.shiftKey && selectionAnchor) {
            const minRow = Math.min(selectionAnchor.rowIdx, rowIdx);
            const maxRow = Math.max(selectionAnchor.rowIdx, rowIdx);
            const minCol = Math.min(selectionAnchor.colIdx, colIdx);
            const maxCol = Math.max(selectionAnchor.colIdx, colIdx);
            const newSet = new Set<string>(selectedCells);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    newSet.add(`${r}:${c}`);
                }
            }
            setSelectedCells(newSet);
        } else if (e.metaKey || e.ctrlKey) {
            setSelectedCells(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
            });
            setSelectionAnchor({ rowIdx, colIdx });
        } else {
            setSelectedCells(new Set([key]));
            setSelectionAnchor({ rowIdx, colIdx });
        }
    }, [selectionAnchor, selectedCells]);

    // Select entire row
    const handleRowClick = useCallback((rowIdx: number, e: React.MouseEvent) => {
        const newSet = new Set<string>(e.shiftKey || e.metaKey || e.ctrlKey ? selectedCells : []);
        for (let c = 0; c < numCols; c++) {
            newSet.add(`${rowIdx}:${c}`);
        }
        setSelectedCells(newSet);
        setSelectionAnchor({ rowIdx, colIdx: 0 });
    }, [numCols, selectedCells]);

    // Select entire column
    const handleSelectColumn = useCallback((colIdx: number, e: React.MouseEvent) => {
        const newSet = new Set<string>(e.shiftKey || e.metaKey || e.ctrlKey ? selectedCells : []);
        for (let r = 0; r < displayData.length; r++) {
            newSet.add(`${r}:${colIdx}`);
        }
        setSelectedCells(newSet);
        setSelectionAnchor({ rowIdx: 0, colIdx });
    }, [displayData.length, selectedCells]);

    const clearCellSelection = useCallback(() => {
        setSelectedCells(new Set());
        setSelectionAnchor(null);
    }, []);

    // Build CellSelection for chat
    const buildCellSelection = useCallback((): CellSelection | null => {
        if (selectedCells.size === 0) return null;
        const rowMap = new Map<number, Set<number>>();
        for (const key of selectedCells) {
            const [rStr, cStr] = key.split(":");
            const r = parseInt(rStr);
            const c = parseInt(cStr);
            if (!rowMap.has(r)) rowMap.set(r, new Set());
            rowMap.get(r)!.add(c);
        }

        const rows = Array.from(rowMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([rowIdx, colIdxs]) => {
                const row = displayData[rowIdx];
                if (!row) return null;
                const cells = Array.from(colIdxs).sort((a, b) => a - b).map(colIdx => ({
                    colKey: String(colIdx),
                    colLabel: columns[colIdx] || `Col ${colIdx + 1}`,
                    value: Array.isArray(row) && colIdx < row.length ? (row[colIdx] ?? "") : "",
                }));
                return {
                    rowId: String(rowIdx),
                    rowIndex: rowIdx,
                    cells,
                };
            })
            .filter(Boolean) as CellSelection["rows"];

        return {
            sheetId: hoja.sheet_id,
            sheetName: hoja.nombre || "Hoja importada",
            rows,
        };
    }, [selectedCells, displayData, columns, hoja.sheet_id, hoja.nombre]);

    const handleSendToChat = useCallback(() => {
        const sel = buildCellSelection();
        if (sel && onSendSelectionToChat) {
            onSendSelectionToChat(sel);
            clearCellSelection();
        }
    }, [buildCellSelection, onSendSelectionToChat, clearCellSelection]);

    const applyBulkEdit = useCallback(async () => {
        if (selectedCells.size === 0 || !onPatchCell) return;
        setBulkApplying(true);
        setSaving(true);
        try {
            for (const key of selectedCells) {
                const [rStr, cStr] = key.split(":");
                const rowIdx = parseInt(rStr, 10);
                const colIdx = parseInt(cStr, 10);
                if (!isNaN(rowIdx) && !isNaN(colIdx)) {
                    await onPatchCell(rowIdx, colIdx, bulkEditValue);
                }
            }
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
    }, [selectedCells, bulkEditValue, onPatchCell]);

    const applyReplaceInSelection = useCallback(async () => {
        if (selectedCells.size === 0 || !buscarValue.trim() || !onPatchCell) return;
        setBulkApplying(true);
        setSaving(true);
        try {
            let count = 0;
            for (const key of selectedCells) {
                const [rStr, cStr] = key.split(":");
                const rowIdx = parseInt(rStr, 10);
                const colIdx = parseInt(cStr, 10);
                if (isNaN(rowIdx) || isNaN(colIdx)) continue;
                const row = localData[rowIdx];
                const currentVal = String((row && row[colIdx]) ?? "").trim();
                if (!currentVal.includes(buscarValue)) continue;
                const newVal = currentVal.split(buscarValue).join(reemplazarValue);
                await onPatchCell(rowIdx, colIdx, newVal);
                count++;
            }
            if (count > 0) {
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
    }, [selectedCells, buscarValue, reemplazarValue, localData, onPatchCell]);

    const applyPasteToSelection = useCallback(async () => {
        if (selectedCells.size === 0 || !pasteValues.trim() || !onPatchCell) return;
        const delim = pasteValues.includes("\t") ? "\t" : ",";
        const lines = pasteValues.trim().split(/\r?\n/).map((l) => l.split(delim).map((v) => v.trim()));
        const values = lines.flat();

        const sorted = Array.from(selectedCells)
            .map((key) => {
                const [rStr, cStr] = key.split(":");
                return { rowIdx: parseInt(rStr, 10), colIdx: parseInt(cStr, 10), key };
            })
            .filter((x) => !isNaN(x.rowIdx) && !isNaN(x.colIdx))
            .sort((a, b) => (a.rowIdx !== b.rowIdx ? a.rowIdx - b.rowIdx : a.colIdx - b.colIdx));

        if (values.length !== sorted.length) {
            alert(`Has pegado ${values.length} valor(es) pero hay ${sorted.length} celda(s) seleccionadas. Deben coincidir.`);
            return;
        }

        setBulkApplying(true);
        setSaving(true);
        try {
            for (let i = 0; i < sorted.length; i++) {
                await onPatchCell(sorted[i].rowIdx, sorted[i].colIdx, values[i]);
            }
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
    }, [selectedCells, pasteValues, onPatchCell]);

    // ---- Edit functions ----
    const startEdit = (row: number, col: number, value: any) => {
        setEditingCell({ row, col });
        setEditValue(String(value ?? ""));
    };

    const saveCellEdit = async () => {
        if (editingCell == null) return;
        const { row, col } = editingCell;
        const newData = localData.map((r: any) => [...(r || [])]);
        if (!newData[row]) newData[row] = [];
        newData[row][col] = editValue;
        setLocalData(newData);
        setEditingCell(null);
        setSaving(true);
        try {
            if (onPatchCell) {
                await onPatchCell(row, col, editValue);
            } else {
                await onSave({ datos: newData });
            }
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue("");
    };

    const handleAddRow = async () => {
        const cols = columns.length || 1;
        const emptyRow = Array(cols).fill("");
        const newData = [...localData, emptyRow];
        const newColumnas = localColumnas.length ? localColumnas : ["Columna 1"];
        if (!localColumnas.length) setLocalColumnas(newColumnas);
        setLocalData(newData);
        setSaving(true);
        try {
            await onSave(localColumnas.length ? { datos: newData } : { columnas: newColumnas, datos: newData });
        } finally {
            setSaving(false);
        }
    };

    const handleAddColumn = async () => {
        const newColumnas = [...localColumnas, "Nueva columna"];
        const newData = localData.map((row: any) => [...(row || []), ""]);
        setLocalColumnas(newColumnas);
        setLocalData(newData);
        setSaving(true);
        try {
            await onSave({ columnas: newColumnas, datos: newData });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteColumn = async (colIndex: number) => {
        if (columns.length <= 1) {
            alert("No se puede eliminar la última columna.");
            return;
        }
        if (!confirm(`¿Eliminar la columna "${columns[colIndex] || `Col ${colIndex + 1}`}"?\n\nSe perderán todos los datos de esa columna. Esta acción no se puede deshacer.`)) return;
        const newColumnas = localColumnas.filter((_: any, i: number) => i !== colIndex);
        const newData = localData.map((row: any) => {
            const arr = Array.isArray(row) ? [...row] : [];
            arr.splice(colIndex, 1);
            return arr;
        });
        setLocalColumnas(newColumnas);
        setLocalData(newData);
        setSaving(true);
        try {
            await onSave({ columnas: newColumnas, datos: newData });
        } finally {
            setSaving(false);
        }
    };

    const startRenameCol = (colIndex: number) => {
        setEditingColIndex(colIndex);
        setEditColValue(columns[colIndex] ?? "");
    };

    const saveRenameCol = async () => {
        if (editingColIndex == null) return;
        const newColumnas = [...localColumnas];
        if (newColumnas.length <= editingColIndex) {
            while (newColumnas.length <= editingColIndex) newColumnas.push("");
        }
        newColumnas[editingColIndex] = editColValue.trim() || `Col ${editingColIndex + 1}`;
        setLocalColumnas(newColumnas);
        setEditingColIndex(null);
        setSaving(true);
        try {
            await onSave({ columnas: newColumnas });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSheet = async () => {
        if (!confirm("¿Eliminar esta hoja importada? Se perderán todos los datos de la hoja. Esta acción no se puede deshacer.")) return;
        setSaving(true);
        try {
            await onDelete();
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") saveCellEdit();
        else if (e.key === "Escape") cancelEdit();
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-[var(--bg-dark)] shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
                    Hoja importada (editable)
                </span>
                {isRenamingSheet ? (
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            value={sheetNameValue}
                            onChange={(e) => setSheetNameValue(e.target.value)}
                            onBlur={async () => {
                                if (sheetNameValue.trim() && onRename) {
                                    await onRename(sheetNameValue.trim());
                                }
                                setIsRenamingSheet(false);
                            }}
                            onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                    if (sheetNameValue.trim() && onRename) {
                                        await onRename(sheetNameValue.trim());
                                    }
                                    setIsRenamingSheet(false);
                                } else if (e.key === "Escape") {
                                    setSheetNameValue(hoja.nombre || "");
                                    setIsRenamingSheet(false);
                                }
                            }}
                            autoFocus
                            className="bg-gray-100 border border-purple-500/50 rounded px-2 py-0.5 text-gray-800 text-xs min-w-[120px] focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                        />
                    </div>
                ) : (
                    <span
                        className="text-xs text-gray-700 font-medium cursor-pointer hover:text-purple-400 transition-colors flex items-center gap-1"
                        title="Doble clic para renombrar"
                        onDoubleClick={() => {
                            setSheetNameValue(hoja.nombre || "");
                            setIsRenamingSheet(true);
                        }}
                    >
                        {hoja.nombre || "Sin nombre"}
                        <Edit3 size={10} className="text-gray-500" />
                    </span>
                )}
                <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={saving}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs"
                >
                    <Plus size={12} />
                    Añadir fila
                </button>
                <button
                    type="button"
                    onClick={handleAddColumn}
                    disabled={saving}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs"
                >
                    <Plus size={12} />
                    Añadir columna
                </button>
                <button
                    type="button"
                    onClick={handleDeleteSheet}
                    disabled={saving}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs ml-auto"
                >
                    <Trash2 size={12} />
                    Eliminar hoja
                </button>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--bg-darker)]">
                {displayData.length === 0 && columns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <FileSpreadsheet size={48} className="mb-4 text-gray-600" />
                        <p>Hoja vacía: {hoja.nombre}</p>
                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="mt-3 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/30"
                        >
                            Añadir primera fila
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10 bg-[var(--bg-dark)]">
                            <tr>
                                <th className="w-12 px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase border-b border-r border-gray-200">
                                    #
                                </th>
                                {columns.map((col: string, idx: number) => (
                                    <th
                                        key={idx}
                                        className="group relative px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase border-b border-r border-gray-200 whitespace-nowrap max-w-[200px] cursor-pointer hover:bg-gray-50"
                                        onClick={(e) => handleSelectColumn(idx, e)}
                                    >
                                        {editingColIndex === idx ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={editColValue}
                                                    onChange={(e) => setEditColValue(e.target.value)}
                                                    onBlur={saveRenameCol}
                                                    onKeyDown={(e) => e.key === "Enter" && saveRenameCol()}
                                                    autoFocus
                                                    className="w-full min-w-[80px] bg-gray-100 border border-purple-500/50 rounded px-1.5 py-0.5 text-gray-800 text-xs"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <span
                                                    className="truncate block cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 pr-6"
                                                    title="Doble clic para renombrar"
                                                    onDoubleClick={(e) => { e.stopPropagation(); startRenameCol(idx); }}
                                                >
                                                    {String(col || `Col ${idx + 1}`)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteColumn(idx);
                                                    }}
                                                    disabled={saving || columns.length <= 1}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-0 disabled:cursor-not-allowed"
                                                    title="Eliminar columna"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((row: any, rowIdx: number) => (
                                <tr key={rowIdx} className="group hover:bg-gray-50 transition-colors">
                                    <td
                                        className="px-3 py-2 text-gray-500 text-xs font-mono border-b border-r border-gray-200 bg-[var(--bg-dark)] cursor-pointer hover:bg-blue-500/10 hover:text-blue-400 select-none"
                                        onClick={(e) => handleRowClick(rowIdx, e)}
                                        title="Clic para seleccionar fila"
                                    >
                                        {rowIdx + 1}
                                    </td>
                                    {Array.from({ length: numCols }, (_, colIdx) => {
                                        const cell = Array.isArray(row) && colIdx < row.length ? row[colIdx] : undefined;
                                        const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                                        const matchIdx = searchResults.findIndex((m) => m.rowIndex === rowIdx && m.colKey === colIdx);
                                        const isSearchMatch = matchIdx >= 0;
                                        const isActiveMatch = matchIdx === searchActiveIndex;
                                        const isCellSelected = selectedCells.has(`${rowIdx}:${colIdx}`);
                                        return (
                                            <td
                                                key={colIdx}
                                                data-search-row={rowIdx}
                                                data-search-col={colIdx}
                                                onClick={(e) => {
                                                    if (isEditing) return;
                                                    handleCellClick(rowIdx, colIdx, e);
                                                }}
                                                onDoubleClick={() => {
                                                    if (!isEditing) {
                                                        startEdit(rowIdx, colIdx, cell);
                                                    }
                                                }}
                                                className={`px-3 py-2 text-gray-700 border-b border-r border-gray-200 cursor-pointer select-none transition-colors ${isCellSelected
                                                    ? "bg-blue-500/20 ring-1 ring-inset ring-blue-500/40"
                                                    : isSearchMatch
                                                        ? (isActiveMatch ? "bg-amber-500/30 ring-1 ring-amber-500/60" : "bg-amber-500/15")
                                                        : "hover:bg-gray-100"
                                                    }`}
                                            >
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            autoFocus
                                                            className="w-full bg-gray-100 border border-emerald-500/50 rounded-lg px-2 py-1 text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); saveCellEdit(); }}
                                                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                                                        >
                                                            <Save size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                                            className="p-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="max-w-[200px] truncate block min-h-[28px]">
                                                        {cell !== null && cell !== undefined ? String(cell) : ""}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Floating Cell Selection Bar */}
            {selectedCells.size > 0 && (
                <div className="px-4 py-2.5 border-t border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent flex items-center justify-between shrink-0">
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
                        {onPatchCell && (
                            <>
                                <input
                                    type="text"
                                    value={bulkEditValue}
                                    onChange={(e) => setBulkEditValue(e.target.value)}
                                    placeholder="Nuevo valor para todas"
                                    className="w-40 px-3 py-1.5 rounded-lg bg-gray-100 border border-white/10 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                />
                                <button
                                    onClick={applyBulkEdit}
                                    disabled={bulkApplying}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bulkApplying ? "..." : "Aplicar"}
                                </button>
                                <div className="w-px h-5 bg-gray-200" />
                                <textarea
                                    value={pasteValues}
                                    onChange={(e) => setPasteValues(e.target.value)}
                                    placeholder="Pegar (tab o coma entre columnas, Enter entre filas)"
                                    rows={1}
                                    className="w-48 min-h-[32px] max-h-16 px-3 py-1.5 rounded-lg bg-gray-100 border border-white/10 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50 resize-y"
                                />
                                <button
                                    onClick={applyPasteToSelection}
                                    disabled={bulkApplying || !pasteValues.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bulkApplying ? "..." : "Asignar"}
                                </button>
                                <div className="w-px h-5 bg-gray-200" />
                                <input
                                    type="text"
                                    value={buscarValue}
                                    onChange={(e) => setBuscarValue(e.target.value)}
                                    placeholder="Buscar"
                                    className="w-28 px-2.5 py-1.5 rounded-lg bg-gray-100 border border-white/10 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                />
                                <span className="text-gray-500 text-xs">→</span>
                                <input
                                    type="text"
                                    value={reemplazarValue}
                                    onChange={(e) => setReemplazarValue(e.target.value)}
                                    placeholder="Reemplazar"
                                    className="w-28 px-2.5 py-1.5 rounded-lg bg-gray-100 border border-white/10 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50"
                                />
                                <button
                                    onClick={applyReplaceInSelection}
                                    disabled={bulkApplying || !buscarValue.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bulkApplying ? "..." : "Reemplazar"}
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 text-xs transition-colors"
                        >
                            <X size={13} />
                            Limpiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
