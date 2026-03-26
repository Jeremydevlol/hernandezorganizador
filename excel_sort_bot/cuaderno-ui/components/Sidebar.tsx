"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    FolderOpen,
    FolderPlus,
    LayoutGrid,
    FlaskConical,
    ClipboardList,
    BarChart3,
    Wheat,
    Sprout,
    Upload,
    Trash2,
    Pencil,
    Check,
    X,
    GripVertical,
} from "lucide-react";
import { Cuaderno, CuadernoSummary, SheetType, Carpeta } from "@/lib/types";
import { api } from "@/lib/api";
import CreateCuadernoModal from "./modals/CreateCuadernoModal";
import UploadModal from "./modals/UploadModal";

interface SidebarProps {
    cuadernos: (CuadernoSummary | Cuaderno)[];
    activeCuaderno: Cuaderno | null;
    activeSheet: SheetType;
    loading: boolean;
    onSelectCuaderno: (id: string) => void;
    onSelectSheet: (sheet: SheetType) => void;
    onCreateCuaderno: (data: Partial<Cuaderno>) => void;
    onUploadSuccess?: (id: string) => void | Promise<void>;
    onCuadernoDeleted?: () => void | Promise<void>;
}

const LS_FOLDERS_KEY = "cuaderno_carpetas_v1";
const LS_FOLDER_MAP_KEY = "cuaderno_carpeta_map_v1";
const LS_COLLAPSED_KEY = "cuaderno_sidebar_collapsed_v2";

function genId() {
    return "f-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadFolders(): Carpeta[] {
    try {
        const raw = localStorage.getItem(LS_FOLDERS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

function saveFolders(folders: Carpeta[]) {
    try { localStorage.setItem(LS_FOLDERS_KEY, JSON.stringify(folders)); } catch { /* ignore */ }
}

function loadFolderMap(): Record<string, string> {
    try {
        const raw = localStorage.getItem(LS_FOLDER_MAP_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
}

function saveFolderMap(map: Record<string, string>) {
    try { localStorage.setItem(LS_FOLDER_MAP_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function loadCollapsed(): Set<string> {
    try {
        const raw = localStorage.getItem(LS_COLLAPSED_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set();
}

function saveCollapsed(set: Set<string>) {
    try { localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

const SHEET_ITEMS: { key: SheetType; label: string; icon: React.ReactNode }[] = [
    { key: "parcelas", label: "Parcelas", icon: <LayoutGrid size={16} /> },
    { key: "productos", label: "Productos", icon: <FlaskConical size={16} /> },
    { key: "tratamientos", label: "Tratamientos", icon: <ClipboardList size={16} /> },
    { key: "fertilizantes", label: "Fertilizantes", icon: <Sprout size={16} /> },
    { key: "historico", label: "Histórico", icon: <BarChart3 size={16} /> },
];

export default function Sidebar({
    cuadernos,
    activeCuaderno,
    activeSheet,
    loading,
    onSelectCuaderno,
    onSelectSheet,
    onCreateCuaderno,
    onUploadSuccess,
    onCuadernoDeleted,
}: SidebarProps) {
    const [cuadernosExpanded, setCuadernosExpanded] = useState(true);
    const [contenidoExpanded, setContenidoExpanded] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createModalInitialYear, setCreateModalInitialYear] = useState<number | undefined>(undefined);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Folder system
    const [folders, setFolders] = useState<Carpeta[]>([]);
    const [folderMap, setFolderMap] = useState<Record<string, string>>({});
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // Editing
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const editInputRef = useRef<HTMLInputElement>(null);

    // Creating new folder
    const [creatingInParent, setCreatingInParent] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState("");
    const newFolderInputRef = useRef<HTMLInputElement>(null);

    // Drag & drop
    const [dragCuadernoId, setDragCuadernoId] = useState<string | null>(null);
    const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

    useEffect(() => {
        setFolders(loadFolders());
        setFolderMap(loadFolderMap());
        setCollapsed(loadCollapsed());
    }, []);

    const updateFolders = useCallback((next: Carpeta[]) => {
        setFolders(next);
        saveFolders(next);
    }, []);

    const updateFolderMap = useCallback((next: Record<string, string>) => {
        setFolderMap(next);
        saveFolderMap(next);
    }, []);

    const toggleCollapsed = useCallback((id: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            saveCollapsed(next);
            return next;
        });
    }, []);

    // Folder CRUD
    const createFolder = useCallback((parentId: string | null) => {
        setCreatingInParent(parentId);
        setNewFolderName("");
        setTimeout(() => newFolderInputRef.current?.focus(), 50);
    }, []);

    const confirmCreateFolder = useCallback(() => {
        const name = newFolderName.trim();
        if (!name) { setCreatingInParent(null); return; }
        const newFolder: Carpeta = {
            id: genId(),
            nombre: name,
            parent_id: creatingInParent === "__root__" ? null : creatingInParent,
            orden: folders.filter(f => f.parent_id === (creatingInParent === "__root__" ? null : creatingInParent)).length,
        };
        updateFolders([...folders, newFolder]);
        setCreatingInParent(null);
        setNewFolderName("");
        // Auto-expand parent
        if (creatingInParent && collapsed.has(creatingInParent)) {
            toggleCollapsed(creatingInParent);
        }
    }, [newFolderName, creatingInParent, folders, updateFolders, collapsed, toggleCollapsed]);

    const startRenameFolder = useCallback((folder: Carpeta) => {
        setEditingFolderId(folder.id);
        setEditingName(folder.nombre);
        setTimeout(() => editInputRef.current?.focus(), 50);
    }, []);

    const confirmRenameFolder = useCallback(() => {
        if (!editingFolderId) return;
        const name = editingName.trim();
        if (!name) { setEditingFolderId(null); return; }
        updateFolders(folders.map(f => f.id === editingFolderId ? { ...f, nombre: name } : f));
        setEditingFolderId(null);
    }, [editingFolderId, editingName, folders, updateFolders]);

    const deleteFolder = useCallback((folderId: string) => {
        const childFolderIds = new Set<string>();
        const collectChildren = (pid: string) => {
            for (const f of folders) {
                if (f.parent_id === pid) {
                    childFolderIds.add(f.id);
                    collectChildren(f.id);
                }
            }
        };
        childFolderIds.add(folderId);
        collectChildren(folderId);

        updateFolders(folders.filter(f => !childFolderIds.has(f.id)));
        const nextMap = { ...folderMap };
        for (const [cid, fid] of Object.entries(nextMap)) {
            if (childFolderIds.has(fid)) delete nextMap[cid];
        }
        updateFolderMap(nextMap);
    }, [folders, folderMap, updateFolders, updateFolderMap]);

    // Move cuaderno to folder (or to root if folderId is null)
    const moveCuadernoToFolder = useCallback((cuadernoId: string, folderId: string | null) => {
        const nextMap = { ...folderMap };
        if (folderId) {
            nextMap[cuadernoId] = folderId;
        } else {
            delete nextMap[cuadernoId];
        }
        updateFolderMap(nextMap);
    }, [folderMap, updateFolderMap]);

    // Derived: which cuadernos are in each folder
    const rootFolders = useMemo(() =>
        folders.filter(f => f.parent_id === null).sort((a, b) => a.orden - b.orden),
        [folders]
    );

    const childFoldersOf = useCallback((parentId: string) =>
        folders.filter(f => f.parent_id === parentId).sort((a, b) => a.orden - b.orden),
        [folders]
    );

    const cuadernosInFolder = useCallback((folderId: string) =>
        cuadernos.filter(c => folderMap[c.id] === folderId),
        [cuadernos, folderMap]
    );

    const rootCuadernos = useMemo(() =>
        cuadernos.filter(c => !folderMap[c.id]),
        [cuadernos, folderMap]
    );

    // Count total cuadernos recursively in a folder
    const countInFolder = useCallback((folderId: string): number => {
        let count = cuadernosInFolder(folderId).length;
        for (const child of childFoldersOf(folderId)) {
            count += countInFolder(child.id);
        }
        return count;
    }, [cuadernosInFolder, childFoldersOf]);

    const openCreateModal = (year?: number) => {
        setCreateModalInitialYear(year);
        setShowCreateModal(true);
    };

    const toNumber = (v: unknown): number => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, cuadernoId: string) => {
        setDragCuadernoId(cuadernoId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cuadernoId);
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTargetFolderId(folderId);
    };

    const handleDragLeave = () => {
        setDropTargetFolderId(null);
    };

    const handleDrop = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        setDropTargetFolderId(null);
        if (dragCuadernoId) {
            moveCuadernoToFolder(dragCuadernoId, folderId);
        }
        setDragCuadernoId(null);
    };

    const handleDragEnd = () => {
        setDragCuadernoId(null);
        setDropTargetFolderId(null);
    };

    // ---- Render a cuaderno item ----
    const renderCuaderno = (c: CuadernoSummary | Cuaderno) => (
        <div
            key={c.id}
            draggable
            onDragStart={(e) => handleDragStart(e, c.id)}
            onDragEnd={handleDragEnd}
            className={`group relative w-full px-2.5 py-2 rounded-md text-sm transition-colors ${
                dragCuadernoId === c.id ? "opacity-40" : ""
            } ${
                activeCuaderno?.id === c.id
                    ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                    : "hover:bg-gray-100"
            }`}
        >
            <div className="flex items-center gap-1">
                <GripVertical size={10} className="shrink-0 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                    onClick={() => onSelectCuaderno(c.id)}
                    className={`flex-1 min-w-0 text-left ${
                        activeCuaderno?.id === c.id
                            ? "text-emerald-400"
                            : "text-gray-600 hover:text-gray-800"
                    }`}
                >
                    <div className="font-medium truncate pr-6">{c.nombre_explotacion}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        {("titular" in c && (c as CuadernoSummary).titular) ? `${(c as CuadernoSummary).titular} · ` : ""}
                        {c.año} · {("num_parcelas" in c ? c.num_parcelas : 0)}P · {("num_tratamientos" in c ? c.num_tratamientos : 0)}T
                    </div>
                </button>
            </div>
            <button
                onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`¿Eliminar el cuaderno "${c.nombre_explotacion}"?\n\nSe creará un backup. Esta acción no se puede deshacer.`))
                        return;
                    try {
                        await api.deleteCuaderno(c.id);
                        if (onCuadernoDeleted) await onCuadernoDeleted();
                        if (activeCuaderno?.id === c.id) {
                            const other = cuadernos.find((x) => x.id !== c.id);
                            onSelectCuaderno(other?.id || "");
                        }
                    } catch (error) {
                        alert("No se pudo eliminar el cuaderno.");
                        console.error(error);
                    }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                title="Eliminar cuaderno"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );

    // ---- Render a folder recursively ----
    const renderFolder = (folder: Carpeta, depth: number = 0) => {
        const isExpanded = !collapsed.has(folder.id);
        const children = childFoldersOf(folder.id);
        const cuads = cuadernosInFolder(folder.id);
        const totalCount = countInFolder(folder.id);
        const isEditing = editingFolderId === folder.id;
        const isDropTarget = dropTargetFolderId === folder.id;
        const isCreatingChild = creatingInParent === folder.id;

        return (
            <div key={folder.id} className="mb-0.5">
                <div
                    className={`flex items-center gap-0.5 pr-1 group/folder rounded-md transition-colors ${
                        isDropTarget ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : ""
                    }`}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                >
                    {isEditing ? (
                        <div className="flex-1 flex items-center gap-1 px-2 py-1">
                            <FolderOpen size={12} className="shrink-0 text-amber-500/80" />
                            <input
                                ref={editInputRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") confirmRenameFolder();
                                    if (e.key === "Escape") setEditingFolderId(null);
                                }}
                                className="flex-1 text-[11px] font-medium bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                            />
                            <button onClick={confirmRenameFolder} className="p-0.5 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                <Check size={12} />
                            </button>
                            <button onClick={() => setEditingFolderId(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                                <X size={12} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => toggleCollapsed(folder.id)}
                                className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                            >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <FolderOpen size={12} className="shrink-0 text-amber-500/80" />
                                <span className="truncate">{folder.nombre}</span>
                                <span className="text-gray-400 font-normal">({totalCount})</span>
                            </button>
                            <div className="shrink-0 flex items-center gap-0 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); createFolder(folder.id); }}
                                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                                    title="Nueva subcarpeta"
                                >
                                    <FolderPlus size={11} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openCreateModal(); }}
                                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                                    title="Nuevo cuaderno"
                                >
                                    <Plus size={11} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); startRenameFolder(folder); }}
                                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
                                    title="Renombrar"
                                >
                                    <Pencil size={10} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`¿Eliminar carpeta "${folder.nombre}" y sacar los cuadernos a la raíz?`)) {
                                            deleteFolder(folder.id);
                                        }
                                    }}
                                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                    title="Eliminar carpeta"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
                {isExpanded && (
                    <div className="ml-2 pl-2 border-l border-gray-200/80 space-y-0.5 mt-0.5">
                        {children.map(child => renderFolder(child, depth + 1))}
                        {isCreatingChild && (
                            <div className="flex items-center gap-1 px-2 py-1">
                                <FolderOpen size={12} className="shrink-0 text-amber-500/80" />
                                <input
                                    ref={newFolderInputRef}
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") confirmCreateFolder();
                                        if (e.key === "Escape") setCreatingInParent(null);
                                    }}
                                    onBlur={() => { if (!newFolderName.trim()) setCreatingInParent(null); }}
                                    placeholder="Nombre de carpeta..."
                                    className="flex-1 text-[11px] font-medium bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                                />
                                <button onClick={confirmCreateFolder} className="p-0.5 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                    <Check size={12} />
                                </button>
                                <button onClick={() => setCreatingInParent(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        {cuads.map(renderCuaderno)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <aside className="min-w-0 flex-1 flex flex-col bg-[var(--bg-dark)] border-r border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-gray-200 electron-drag">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Wheat className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="font-medium text-sm text-gray-900 tracking-tight">Cuaderno Agrícola</span>
                    </div>
                </div>

                {/* Explorer */}
                <div className="flex-1 overflow-y-auto py-2">
                    <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Explorador
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-emerald-400 hover:bg-gray-100 transition-colors"
                                title="Importar archivo"
                            >
                                <Upload size={14} />
                            </button>
                            <button
                                onClick={() => openCreateModal()}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Nuevo cuaderno"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    {/* CUADERNOS root section */}
                    <div className="px-2">
                        <div
                            className={`flex items-center gap-0.5 pr-1 group/root rounded-md transition-colors ${
                                dropTargetFolderId === "__root__" ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : ""
                            }`}
                            onDragOver={(e) => handleDragOver(e, "__root__")}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, null)}
                        >
                            <button
                                onClick={() => setCuadernosExpanded(!cuadernosExpanded)}
                                className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors uppercase tracking-wider"
                            >
                                {cuadernosExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <FolderOpen size={12} />
                                <span>Cuadernos</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); createFolder("__root__"); }}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover/root:opacity-100 transition-opacity"
                                title="Nueva carpeta"
                            >
                                <FolderPlus size={13} />
                            </button>
                        </div>

                        {cuadernosExpanded && (
                            <div className="mt-1 space-y-0.5">
                                {loading ? (
                                    <div className="px-4 py-2 text-xs text-gray-500">Cargando...</div>
                                ) : cuadernos.length === 0 ? (
                                    <div className="px-4 py-2 text-xs text-gray-500">Sin cuadernos</div>
                                ) : (
                                    <>
                                        {/* Custom folders */}
                                        {rootFolders.map(f => renderFolder(f))}

                                        {/* New folder input at root level */}
                                        {creatingInParent === "__root__" && (
                                            <div className="flex items-center gap-1 px-2 py-1 ml-2">
                                                <FolderOpen size={12} className="shrink-0 text-amber-500/80" />
                                                <input
                                                    ref={newFolderInputRef}
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") confirmCreateFolder();
                                                        if (e.key === "Escape") setCreatingInParent(null);
                                                    }}
                                                    onBlur={() => { if (!newFolderName.trim()) setCreatingInParent(null); }}
                                                    placeholder="Nombre de carpeta..."
                                                    className="flex-1 text-[11px] font-medium bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400"
                                                />
                                                <button onClick={confirmCreateFolder} className="p-0.5 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                                    <Check size={12} />
                                                </button>
                                                <button onClick={() => setCreatingInParent(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Cuadernos not in any folder (root level) */}
                                        {rootCuadernos.length > 0 && (
                                            <div className="ml-2 pl-2 border-l border-gray-200/80 space-y-0.5">
                                                {rootCuadernos.map(renderCuaderno)}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Contenido Section */}
                    {activeCuaderno && (
                        <div className="px-2 mt-4">
                            <button
                                onClick={() => setContenidoExpanded(!contenidoExpanded)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors uppercase tracking-wider"
                            >
                                {contenidoExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <ClipboardList size={12} />
                                <span>Contenido</span>
                            </button>

                            {contenidoExpanded && (
                                <div className="mt-1 space-y-0.5">
                                    {SHEET_ITEMS.map((item) => {
                                        const count =
                                            item.key === "parcelas" ? activeCuaderno.parcelas?.length :
                                                item.key === "productos" ? activeCuaderno.productos?.length :
                                                    item.key === "tratamientos" ? activeCuaderno.tratamientos?.length :
                                                        item.key === "fertilizantes" ? ((activeCuaderno as any).fertilizaciones?.length ?? null) : null;

                                        return (
                                            <button
                                                key={item.key}
                                                onClick={() => onSelectSheet(item.key)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeSheet === item.key
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                                    }`}
                                            >
                                                {item.icon}
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {count !== null && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeSheet === item.key
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Parcelas por Cultivo */}
                    {activeCuaderno && activeCuaderno.parcelas?.length > 0 && (
                        <div className="px-2 mt-4">
                            <div className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                                <Wheat size={12} />
                                <span>Parcelas por Cultivo</span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                                {(() => {
                                    const grouped: Record<string, { count: number; ha: number }> = {};
                                    for (const p of activeCuaderno.parcelas) {
                                        const cultivo = p.especie || p.cultivo || "Sin cultivo";
                                        if (!grouped[cultivo]) grouped[cultivo] = { count: 0, ha: 0 };
                                        grouped[cultivo].count++;
                                        grouped[cultivo].ha += toNumber(p.superficie_cultivada ?? p.superficie_ha ?? p.superficie_sigpac);
                                    }
                                    return Object.entries(grouped).sort((a, b) => b[1].ha - a[1].ha).map(([cultivo, info]) => (
                                        <button
                                            key={cultivo}
                                            onClick={() => onSelectSheet("parcelas")}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-emerald-500/60 shrink-0" />
                                            <span className="flex-1 text-left truncate">{cultivo}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                                                {info.count}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80">
                                                {toNumber(info.ha).toFixed(1)} ha
                                            </span>
                                        </button>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                {activeCuaderno && (
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-100">
                        <div className="text-[11px] space-y-1.5">
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500 shrink-0">Titular</span>
                                <span className="text-emerald-400/90 font-medium truncate text-right">
                                    {activeCuaderno.titular || "-"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Año</span>
                                <span className="text-gray-700">{activeCuaderno.año}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total hectáreas</span>
                                <span className="text-emerald-400 font-semibold">
                                    {(activeCuaderno.parcelas || []).reduce((sum: number, p: any) => sum + toNumber(p.superficie_cultivada ?? p.superficie_ha ?? p.superficie_sigpac), 0).toFixed(2)} ha
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Create Modal */}
            <CreateCuadernoModal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setCreateModalInitialYear(undefined);
                }}
                onCreate={onCreateCuaderno}
                initialYear={createModalInitialYear}
            />

            {/* Upload Modal */}
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onSuccess={async (id) => {
                    setShowUploadModal(false);
                    if (onUploadSuccess) {
                        await onUploadSuccess(id);
                    } else {
                        onSelectCuaderno(id);
                    }
                }}
            />
        </>
    );
}
