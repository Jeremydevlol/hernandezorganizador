"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, CheckCircle, Plus, MessageSquare, Table2, ChevronDown, ChevronUp } from "lucide-react";
import { Cuaderno, SheetType, SHEET_CONFIG, CellSelection } from "@/lib/types";
import { api } from "@/lib/api";
import type { ChatSession, ChatMessage } from "@/lib/types";

interface ChatPanelProps {
    cuaderno: Cuaderno | null;
    messages: ChatMessage[];
    onMessagesChange: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    sessions: ChatSession[];
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onClose: () => void;
    onRefresh: () => void | Promise<void>;
    onNavigate?: (nav: { sheet: SheetType; id: string; label?: string }) => void;
    /** Hoja activa en modo focus (seleccionada desde "+"). null = edición global. */
    focusSheetId?: string | null;
    /** Al seleccionar una hoja desde el selector: entrar en modo focus. */
    onSelectSheetFromChat?: (sheetId: string) => void;
    /** Salir del modo focus (volver al cuaderno completo). */
    onFocusModeExit?: () => void;
    /** Ref a acciones del editor (buscar, reemplazar). */
    editorActionsRef?: React.MutableRefObject<{ openSearch: (q?: string) => void; replacePreview: (from: string, to: string) => number; replaceApply: (from: string, to: string) => Promise<void> } | null>;
    /** Selección de celdas pendiente desde el Editor */
    pendingSelection?: CellSelection | null;
    /** Callback para consumir la selección tras adjuntarla */
    onSelectionConsumed?: () => void;
}

const SUGGESTIONS = [
    { label: "Añadir parcela", cmd: "añade una parcela llamada Huerta Norte de 5 hectáreas con olivos" },
    { label: "Nuevo producto", cmd: "añade producto Roundup con registro ES-001234" },
    { label: "Tratamiento", cmd: "registra un tratamiento para controlar pulgón" },
];

const BASE_SHEETS: { id: SheetType; nombre: string }[] = [
    { id: "parcelas", nombre: "2.1 Datos Parcelas" },
    { id: "productos", nombre: "Productos Fitosanitarios" },
    { id: "tratamientos", nombre: "3.1 Registro Tratamientos" },
    { id: "fertilizantes", nombre: "Registro Fertilizantes" },
    { id: "cosecha", nombre: "Registro Cosecha" },
    { id: "historico", nombre: "Histórico Completo" },
];

export default function ChatPanel({
    cuaderno,
    messages,
    onMessagesChange,
    sessions,
    activeSessionId,
    onSelectSession,
    onNewChat,
    onClose,
    onRefresh,
    onNavigate,
    focusSheetId = null,
    onSelectSheetFromChat,
    onFocusModeExit,
    editorActionsRef,
    pendingSelection = null,
    onSelectionConsumed,
}: ChatPanelProps) {
    const setMessages = onMessagesChange;

    const [input, setInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [sheetSelectorOpen, setSheetSelectorOpen] = useState(false);
    const [sheetSearch, setSheetSearch] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const sheetSelectorRef = useRef<HTMLDivElement>(null);
    const [attachedSelection, setAttachedSelection] = useState<CellSelection | null>(null);
    const [selectionExpanded, setSelectionExpanded] = useState(true);
    const [pendingBulkDateEdit, setPendingBulkDateEdit] = useState<{
        originalMessage: string;
        selection: CellSelection;
    } | null>(null);
    const formatTime = (ts?: number) =>
        ts ? new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";

    const countSelectionCells = (sel: CellSelection | null) =>
        sel ? sel.rows.reduce((sum, r) => sum + r.cells.length, 0) : 0;

    const detectBulkDateIntent = (raw: string) => {
        const t = raw.toLowerCase();
        const dateLike = /(fecha|hoy|mañana|manana|inicio|fin|desde|hasta)/.test(t);
        const bulkLike = /(fila completa|toda la fila|todas las filas|fila entera|toda la selección|toda la seleccion|rango)/.test(t);
        return { dateLike, bulkLike };
    };

    const hasDirection = (raw: string) => {
        const t = raw.toLowerCase();
        return /(antes|arriba|encima|despu[eé]s|despues|abajo|debajo)/.test(t);
    };

    const sheetList = (() => {
        const getBaseRows = (id: SheetType) => {
            if (!cuaderno) return 0;
            if (id === "parcelas") return cuaderno.parcelas?.length ?? 0;
            if (id === "productos") return cuaderno.productos?.length ?? 0;
            if (id === "tratamientos") return cuaderno.tratamientos?.length ?? 0;
            if (id === "fertilizantes") return cuaderno.fertilizaciones?.length ?? 0;
            if (id === "cosecha") return cuaderno.cosechas?.length ?? 0;
            return 0;
        };
        const config = (id: SheetType) => SHEET_CONFIG[id]?.columns?.length ?? 0;
        const base = BASE_SHEETS.map((s) => ({
            sheetId: s.id,
            nombre: s.nombre,
            tipo: "base" as const,
            rows: getBaseRows(s.id),
            cols: config(s.id),
        }));
        const imported = (cuaderno?.hojas_originales || []).map((h) => ({
            sheetId: h.sheet_id,
            nombre: h.nombre || "Hoja importada",
            tipo: "importada" as const,
            rows: h.datos?.length ?? 0,
            cols: h.columnas?.length ?? h.datos?.[0]?.length ?? 0,
        }));
        return [...base, ...imported];
    })();

    const filteredSheets = sheetSearch.trim()
        ? sheetList.filter((s) =>
            s.nombre.toLowerCase().includes(sheetSearch.trim().toLowerCase())
        )
        : sheetList;

    useEffect(() => {
        const outside = (e: MouseEvent) => {
            if (sheetSelectorRef.current && !sheetSelectorRef.current.contains(e.target as Node)) {
                setSheetSelectorOpen(false);
            }
        };
        if (sheetSelectorOpen) document.addEventListener("mousedown", outside);
        return () => document.removeEventListener("mousedown", outside);
    }, [sheetSelectorOpen]);

    // Recibir selección desde el Editor
    useEffect(() => {
        if (pendingSelection && pendingSelection.rows.length > 0) {
            setAttachedSelection(pendingSelection);
            setSelectionExpanded(true);
            onSelectionConsumed?.();
            // Focus en el textarea
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [pendingSelection, onSelectionConsumed]);

    const handleSelectSheet = (sheetId: string) => {
        onSelectSheetFromChat?.(sheetId);
        setSheetSelectorOpen(false);
        setSheetSearch("");
    };

    const handleFocusCommand = (cmd: string) => {
        const rest = cmd.slice(6).trim().toLowerCase();
        setMessages((prev) => [...prev, { role: "user", content: cmd }]);
        if (rest === "off" || rest === "") {
            onFocusModeExit?.();
            setMessages((prev) => [...prev, { role: "assistant", content: "↩️ Modo edición global activado." }]);
            return true;
        }
        const match = sheetList.find((s) =>
            s.sheetId.toLowerCase() === rest || s.nombre.toLowerCase().includes(rest)
        );
        if (match) {
            onSelectSheetFromChat?.(match.sheetId);
            setMessages((prev) => [...prev, { role: "assistant", content: `📌 Editando: **${match.nombre}**` }]);
            return true;
        }
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Hoja no encontrada. Usa /sheet para ver la lista.` }]);
        return true;
    };

    const handleSheetCommand = (cmd: string) => {
        const rest = cmd.slice(6).trim().toLowerCase();
        setMessages((prev) => [...prev, { role: "user", content: cmd }]);
        if (!rest) {
            setSheetSelectorOpen(true);
            setMessages((prev) => [...prev, { role: "assistant", content: "👇 Selecciona una hoja del selector." }]);
            return true;
        }
        const match = sheetList.find((s) =>
            s.sheetId.toLowerCase() === rest || s.nombre.toLowerCase().includes(rest)
        );
        if (match) {
            onSelectSheetFromChat?.(match.sheetId);
            setMessages((prev) => [...prev, { role: "assistant", content: `📌 Editando: **${match.nombre}**` }]);
            return true;
        }
        setSheetSelectorOpen(true);
        return true;
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        const maxHeight = 200;
        el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    }, [input]);

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;
        const raw = input.trim();
        setInput("");

        if (!cuaderno) {
            setMessages([
                ...messages,
                { role: "user", content: raw },
                { role: "assistant", content: "⚠️ Por favor, abre un cuaderno primero para poder ejecutar comandos." }
            ]);
            return;
        }

        if (raw === "/focus" || raw.startsWith("/focus ")) {
            handleFocusCommand(raw);
            return;
        }
        if (raw === "/sheet" || raw.startsWith("/sheet ")) {
            handleSheetCommand(raw);
            return;
        }

        const findMatch = raw.match(/^\/find\s+(?:"([^"]+)"|(.+))$/i);
        if (findMatch) {
            const query = (findMatch[1] ?? findMatch[2] ?? "").trim();
            setMessages((prev) => [...prev, { role: "user", content: raw }]);
            editorActionsRef?.current?.openSearch(query);
            setMessages((prev) => [...prev, { role: "assistant", content: query ? `🔍 Buscando en la hoja activa: **${query}**` : "🔍 Abriendo búsqueda en la hoja activa." }]);
            return;
        }

        const replaceMatch = raw.match(/^\/replace\s+(?:"([^"]+)"|(\S+))\s+with\s+(?:"([^"]+)"|(\S+))(?:\s+preview)?$/i)
            || raw.match(/^\/replace-all\s+(?:"([^"]+)"|(\S+))\s+with\s+(?:"([^"]+)"|(\S+))$/i);
        if (replaceMatch) {
            const from = (replaceMatch[1] ?? replaceMatch[2] ?? "").trim();
            const to = (replaceMatch[3] ?? replaceMatch[4] ?? "").trim();
            setMessages((prev) => [...prev, { role: "user", content: raw }]);
            const count = editorActionsRef?.current?.replacePreview(from, to) ?? 0;
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: count > 0
                        ? `Se modificarán **${count}** celda(s). ¿Aplicar reemplazo?\n• Buscar: "${from}"\n• Reemplazar por: "${to}"`
                        : `No hay coincidencias para "${from}" en la hoja activa.`,
                    replaceFrom: count > 0 ? from : undefined,
                    replaceTo: count > 0 ? to : undefined,
                }
            ]);
            return;
        }

        // Flujo de confirmación: edición masiva de fechas en filas completas.
        // Si falta dirección (antes/después), pedimos confirmación y NO ejecutamos todavía.
        if (pendingBulkDateEdit) {
            const t = raw.toLowerCase();
            const isCancel = /(cancelar|cancela|no|descartar)/.test(t);
            const isBefore = /(antes|arriba|encima)/.test(t);
            const isAfter = /(despu[eé]s|despues|abajo|debajo)/.test(t);
            const looksLikeNewInstruction = /(cambia|edita|actualiza|pon|añade|agrega|elimina|borra|ordena|importa|busca|listar|\/)/.test(t);

            // Si parece una nueva instrucción, no bloquear al usuario:
            // descartar confirmación pendiente y continuar flujo normal.
            if (!isCancel && !isBefore && !isAfter && looksLikeNewInstruction) {
                setPendingBulkDateEdit(null);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        createdAt: Date.now(),
                        content: "ℹ️ Cancelé la confirmación pendiente y procesaré tu nueva instrucción.",
                    },
                ]);
            } else {
                setMessages((prev) => [...prev, { role: "user", createdAt: Date.now(), content: raw }]);
            }

            if (isCancel) {
                setPendingBulkDateEdit(null);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        createdAt: Date.now(),
                        content: "❌ Operación cancelada. No se aplicó ningún cambio.",
                    },
                ]);
                return;
            }

            if (!isBefore && !isAfter) {
                if (looksLikeNewInstruction) {
                    // Ya se notificó arriba; continuar con flujo normal.
                } else {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "assistant",
                            createdAt: Date.now(),
                            content: "⚠️ Confírmame dirección con una palabra: **antes** o **después** (o escribe **cancelar**).",
                        },
                    ]);
                    return;
                }
            }

            if (!isBefore && !isAfter && looksLikeNewInstruction) {
                // Continuar con el flujo normal de envío (sin return).
            } else {
                const directionText = isBefore ? "antes de" : "después de";
                const userMessage = `${pendingBulkDateEdit.originalMessage}\n\n[Confirmación: aplicar ${directionText} la(s) fila(s) seleccionada(s)]`;
                const currentSelection = pendingBulkDateEdit.selection;
                setPendingBulkDateEdit(null);

                const selectedRows = currentSelection?.rows.length ?? 0;
                const selectedCells = countSelectionCells(currentSelection);
                const activeSheetName = focusSheetId
                    ? (sheetList.find((s) => s.sheetId === focusSheetId)?.nombre ?? focusSheetId)
                    : undefined;

                setMessages((prev) => [...prev, {
                    role: "user",
                    createdAt: Date.now(),
                    content: userMessage,
                    selectionContext: currentSelection ?? undefined,
                    contextMeta: {
                        activeSheetId: focusSheetId ?? undefined,
                        activeSheetName,
                        selectedRows,
                        selectedCells,
                    },
                }]);
                setIsProcessing(true);
                setAttachedSelection(null);
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", createdAt: Date.now(), content: "Procesando...", isLoading: true }
                ]);

                try {
                    const contexto: Record<string, any> = {};
                    if (focusSheetId) contexto.active_sheet_id = focusSheetId;
                    if (currentSelection) {
                        contexto.selected_cells = {
                            sheet_id: currentSelection.sheetId,
                            sheet_name: currentSelection.sheetName,
                            rows: currentSelection.rows.map(r => ({
                                row_id: r.rowId,
                                row_index: r.rowIndex,
                                cells: r.cells.map(c => ({
                                    col_key: c.colKey,
                                    col_label: c.colLabel,
                                    value: c.value,
                                })),
                            })),
                        };
                    }

                    const response = await api.executeChat(
                        cuaderno.id,
                        userMessage,
                        Object.keys(contexto).length > 0 ? contexto : undefined
                    );

                    setMessages((prev) => {
                        const filtered = prev.filter(m => !m.isLoading);
                        return [
                            ...filtered,
                            {
                                role: "assistant",
                                createdAt: Date.now(),
                                content: response.mensaje,
                                action: response.accion_ejecutada,
                                datos: response.datos_creados,
                                sugerencias: response.sugerencias
                            }
                        ];
                    });

                    if (response.accion_ejecutada) {
                        await Promise.resolve(onRefresh());
                    }
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : "No se pudo procesar el comando";
                    setMessages((prev) => {
                        const filtered = prev.filter(m => !m.isLoading);
                        return [
                            ...filtered,
                            { role: "assistant", createdAt: Date.now(), content: `❌ Error: ${errMsg}. Intenta reformular tu petición.` }
                        ];
                    });
                } finally {
                    setIsProcessing(false);
                }
                return;
            }
        }

        const userMessage = raw;
        const currentSelection = attachedSelection;

        // Detección preventiva para evitar cambios masivos ambiguos con fechas.
        if (currentSelection) {
            const { dateLike, bulkLike } = detectBulkDateIntent(raw);
            const selectedRows = currentSelection.rows.length;
            const selectedCells = countSelectionCells(currentSelection);
            const uniqueCols = new Set(
                currentSelection.rows.flatMap((r) => r.cells.map((c) => String(c.colKey)))
            ).size;
            const likelyFullRows = selectedRows > 0 && uniqueCols > 0 &&
                currentSelection.rows.every((r) => r.cells.length >= uniqueCols);

            if (dateLike && (bulkLike || likelyFullRows || selectedCells >= 8) && !hasDirection(raw)) {
                setMessages((prev) => [
                    ...prev,
                    { role: "user", createdAt: Date.now(), content: raw, selectionContext: currentSelection },
                    {
                        role: "assistant",
                        createdAt: Date.now(),
                        content:
                            `🧠 Antes de aplicar el cambio masivo de fecha en la selección, confirma dirección:\n\n` +
                            `¿Quieres que empiece **antes** o **después** de la(s) fila(s) seleccionada(s)?\n\n` +
                            `Responde solo: **antes** o **después** (o **cancelar**).`,
                    },
                ]);
                setPendingBulkDateEdit({ originalMessage: raw, selection: currentSelection });
                return;
            }
        }

        const selectedRows = currentSelection?.rows.length ?? 0;
        const selectedCells = currentSelection?.rows.reduce((sum, r) => sum + r.cells.length, 0) ?? 0;
        const activeSheetName = focusSheetId
            ? (sheetList.find((s) => s.sheetId === focusSheetId)?.nombre ?? focusSheetId)
            : undefined;

        setMessages([...messages, {
            role: "user",
            createdAt: Date.now(),
            content: userMessage,
            selectionContext: currentSelection ?? undefined,
            contextMeta: {
                activeSheetId: focusSheetId ?? undefined,
                activeSheetName,
                selectedRows,
                selectedCells,
            },
        }]);
        setIsProcessing(true);
        setAttachedSelection(null); // Consumir la selección

        setMessages((prev) => [
            ...prev,
            { role: "assistant", createdAt: Date.now(), content: "Procesando...", isLoading: true }
        ]);

        try {
            // Construir contexto con selección de celdas
            const contexto: Record<string, any> = {};
            if (focusSheetId) contexto.active_sheet_id = focusSheetId;
            if (currentSelection) {
                contexto.selected_cells = {
                    sheet_id: currentSelection.sheetId,
                    sheet_name: currentSelection.sheetName,
                    rows: currentSelection.rows.map(r => ({
                        row_id: r.rowId,
                        row_index: r.rowIndex,
                        cells: r.cells.map(c => ({
                            col_key: c.colKey,
                            col_label: c.colLabel,
                            value: c.value,
                        })),
                    })),
                };
            }

            const response = await api.executeChat(
                cuaderno.id,
                userMessage,
                Object.keys(contexto).length > 0 ? contexto : undefined
            );

            setMessages((prev) => {
                const filtered = prev.filter(m => !m.isLoading);
                return [
                    ...filtered,
                    {
                        role: "assistant",
                        createdAt: Date.now(),
                        content: response.mensaje,
                        action: response.accion_ejecutada,
                        datos: response.datos_creados,
                        sugerencias: response.sugerencias
                    }
                ];
            });

            if (response.accion_ejecutada) {
                await Promise.resolve(onRefresh());
                const datos = response.datos_creados;
                if (datos?.elementos?.length && onNavigate) {
                    const first = datos.elementos[0];
                    if (first.tipo === "parcela") {
                        onNavigate({ sheet: "parcelas", id: first.id, label: first.nombre });
                    } else if (first.tipo === "producto") {
                        onNavigate({ sheet: "productos", id: first.id, label: first.nombre });
                    } else if (first.tipo === "tratamiento") {
                        onNavigate({ sheet: "tratamientos", id: first.id });
                    }
                }
            }
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : "No se pudo procesar el comando";
            setMessages((prev) => {
                const filtered = prev.filter(m => !m.isLoading);
                return [
                    ...filtered,
                    { role: "assistant", createdAt: Date.now(), content: `❌ Error: ${errMsg}. Intenta reformular tu petición.` }
                ];
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const pendingSuggestionRef = useRef<string | null>(null);
    const handleSuggestion = (cmd: string) => {
        setInput(cmd);
        pendingSuggestionRef.current = cmd;
    };

    // Auto-enviar cuando handleSuggestion establece un comando
    useEffect(() => {
        if (pendingSuggestionRef.current && input === pendingSuggestionRef.current && !isProcessing) {
            pendingSuggestionRef.current = null;
            handleSend();
        }
    }, [input]);

    return (
        <aside className="min-w-0 flex-1 flex flex-col bg-[var(--bg-dark)] border-l border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 electron-drag border-b border-gray-200">
                <div className="h-12 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles size={16} className="text-emerald-400" />
                        </div>
                        <span className="font-medium text-sm text-zinc-100 tracking-tight">VIera AI</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onNewChat}
                            className="p-2 rounded-md text-gray-500 hover:text-emerald-400 hover:bg-gray-100 transition-colors electron-no-drag"
                            title="Nuevo chat (mismo cuaderno)"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors electron-no-drag"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
                {/* Pestañas de sesiones */}
                <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto min-h-0">
                    {sessions.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => onSelectSession(s.id)}
                            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors electron-no-drag ${activeSessionId === s.id
                                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                }`}
                            title={s.cuadernoId ? `Chat para este cuaderno` : "Chat sin cuaderno"}
                        >
                            <MessageSquare size={12} />
                            <span>{s.cuadernoId ? `Chat ${idx + 1}` : "Nuevo"}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs ${msg.role === "assistant"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-gray-200 text-zinc-300"
                                }`}
                        >
                            {msg.role === "assistant" ? (msg.isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "VI") : "Tú"}
                        </div>
                        <div className={`flex-1 min-w-0 max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}>
                            <div className={`inline-block text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed rounded-xl px-4 py-2.5 ${msg.role === "user"
                                ? "bg-gray-200 text-zinc-100"
                                : "bg-gray-100"
                                }`}>
                                {msg.content}
                            </div>
                            {msg.createdAt && (
                                <div className={`mt-1 text-[10px] text-gray-500 ${msg.role === "user" ? "text-right" : ""}`}>
                                    {formatTime(msg.createdAt)}
                                </div>
                            )}
                            {msg.role === "user" && msg.contextMeta && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {msg.contextMeta.activeSheetName && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                            Hoja: {msg.contextMeta.activeSheetName}
                                        </span>
                                    )}
                                    {(msg.contextMeta.selectedRows ?? 0) > 0 && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                            Selección: {msg.contextMeta.selectedRows} fila(s) · {msg.contextMeta.selectedCells ?? 0} celda(s)
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Mostrar datos creados */}
                            {msg.action && msg.datos && (
                                <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-1.5">
                                        <CheckCircle size={12} />
                                        <span className="font-medium">Acción ejecutada</span>
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                        {Object.entries(msg.datos).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-gray-500">{key}:</span>{" "}
                                                {typeof value === "string" ? value : JSON.stringify(value)}
                                            </div>
                                        ))}
                                    </div>

                                    {Array.isArray((msg.datos as any).elementos) && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {(msg.datos as any).elementos.map((elem: any, idx: number) => {
                                                const tipo = elem.tipo as string | undefined;
                                                const id = elem.id as string | undefined;
                                                const nombre = (elem.nombre as string | undefined) || (elem.producto as string | undefined);

                                                if (!id || !tipo) return null;

                                                let sheet: SheetType | null = null;
                                                if (tipo === "parcela") sheet = "parcelas";
                                                else if (tipo === "producto") sheet = "productos";
                                                else if (tipo === "tratamiento") sheet = "tratamientos";
                                                else if (tipo === "hoja") {
                                                    const label = `Ir a hoja editada: ${nombre || id}`;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                if (onSelectSheetFromChat) onSelectSheetFromChat(id);
                                                            }}
                                                            className="px-2 py-1 text-[10px] rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                                        >
                                                            🔎 {label}
                                                        </button>
                                                    );
                                                }

                                                if (!sheet || !onNavigate) return null;

                                                const label =
                                                    tipo === "tratamiento"
                                                        ? `Ver tratamiento (${(elem.parcelas || []).join(", ") || "sin parcelas"})`
                                                        : `Ver ${tipo}: ${nombre || id}`;

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => onNavigate({ sheet, id, label: nombre })}
                                                        className="px-2 py-1 text-[10px] rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                                    >
                                                        🔎 {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {msg.sugerencias && msg.sugerencias.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {msg.sugerencias.map((sug, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSuggestion(sug.replace(/^\+ /, ""))}
                                            className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-colors cursor-pointer"
                                        >
                                            ▶ {sug}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Reemplazo: Aplicar / Cancelar */}
                            {msg.role === "assistant" && msg.replaceFrom != null && msg.replaceTo != null && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await editorActionsRef?.current?.replaceApply(msg.replaceFrom!, msg.replaceTo!);
                                            setMessages((prev) => {
                                                const next = [...prev];
                                                const i = next.findIndex((m, j) => j === idx);
                                                if (i >= 0) {
                                                    const original = next[i];
                                                    next[i] = { ...original, content: original.content + "\n\n✅ Reemplazo aplicado.", replaceFrom: undefined, replaceTo: undefined };
                                                }
                                                return next;
                                            });
                                        }}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                                    >
                                        Aplicar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMessages((prev) => prev.map((m, j) => j === idx ? { ...m, replaceFrom: undefined, replaceTo: undefined } : m))}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 hover:bg-gray-300 text-zinc-300"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-gray-100">
                {/* Attached Selection Preview */}
                {attachedSelection && (
                    <div className="mb-3 rounded-xl border border-blue-500/30 bg-blue-500/5 overflow-hidden">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectionExpanded(v => !v)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectionExpanded(v => !v); } }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                                    <Table2 size={12} className="text-blue-400" />
                                </div>
                                <span className="text-xs font-medium text-blue-300">
                                    {attachedSelection.sheetName}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                    {attachedSelection.rows.length} fila{attachedSelection.rows.length !== 1 ? "s" : ""} ·{" "}
                                    {attachedSelection.rows.reduce((sum, r) => sum + r.cells.length, 0)} celda{attachedSelection.rows.reduce((sum, r) => sum + r.cells.length, 0) !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {selectionExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setAttachedSelection(null); }}
                                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                        {selectionExpanded && (
                            <div className="max-h-40 overflow-auto border-t border-blue-500/20">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr>
                                            <th className="px-2 py-1.5 text-left text-gray-500 font-medium bg-blue-500/5 border-b border-blue-500/10">#</th>
                                            {(() => {
                                                const allCols = new Map<string, string>();
                                                for (const r of attachedSelection.rows) {
                                                    for (const c of r.cells) {
                                                        if (!allCols.has(c.colKey)) allCols.set(c.colKey, c.colLabel);
                                                    }
                                                }
                                                return Array.from(allCols.entries()).map(([key, label]) => (
                                                    <th key={key} className="px-2 py-1.5 text-left text-gray-500 font-medium bg-blue-500/5 border-b border-blue-500/10 whitespace-nowrap">
                                                        {label}
                                                    </th>
                                                ));
                                            })()}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attachedSelection.rows.map((row, ri) => {
                                            const allCols = new Map<string, string>();
                                            for (const r of attachedSelection.rows) {
                                                for (const c of r.cells) {
                                                    if (!allCols.has(c.colKey)) allCols.set(c.colKey, c.colLabel);
                                                }
                                            }
                                            const cellMap = new Map(row.cells.map(c => [c.colKey, c.value]));
                                            return (
                                                <tr key={ri} className="hover:bg-gray-100">
                                                    <td className="px-2 py-1 text-gray-500 border-b border-gray-200">{row.rowIndex + 1}</td>
                                                    {Array.from(allCols.keys()).map(colKey => (
                                                        <td key={colKey} className="px-2 py-1 text-zinc-300 border-b border-gray-200 max-w-[120px] truncate">
                                                            {cellMap.has(colKey) ? String(cellMap.get(colKey) ?? "-") : "-"}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-3">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s.label}
                            onClick={() => handleSuggestion(s.cmd)}
                            className="px-3 py-1.5 rounded-lg text-[11px] bg-gray-100 border border-gray-200 text-gray-600 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors"
                        >
                            + {s.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 relative" ref={sheetSelectorRef}>
                    <button
                        type="button"
                        onClick={() => cuaderno && onSelectSheetFromChat && setSheetSelectorOpen((o) => !o)}
                        disabled={!cuaderno || !onSelectSheetFromChat}
                        title="Seleccionar hoja para editar"
                        className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 hover:text-emerald-400 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Plus size={20} />
                    </button>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={'Instrucción, /find "texto", /replace "A" with "B", /sheet...'}
                        rows={1}
                        disabled={isProcessing}
                        className="flex-1 bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isProcessing || !input.trim()}
                        className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <Send size={18} />}
                    </button>

                    {/* Dropdown selector de hojas */}
                    {sheetSelectorOpen && cuaderno && (
                        <div className="absolute left-0 bottom-full mb-2 w-80 max-h-72 rounded-xl bg-[var(--bg-dark)] border border-gray-300 shadow-xl overflow-hidden z-50">
                            <div className="p-2 border-b border-gray-200">
                                <input
                                    type="text"
                                    value={sheetSearch}
                                    onChange={(e) => setSheetSearch(e.target.value)}
                                    placeholder="Buscar hoja..."
                                    className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-emerald-500/40"
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto py-1">
                                {filteredSheets.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-gray-500 text-sm">Sin resultados</div>
                                ) : (
                                    filteredSheets.map((s) => (
                                        <button
                                            key={s.sheetId}
                                            type="button"
                                            onClick={() => handleSelectSheet(s.sheetId)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors"
                                        >
                                            <Table2 size={16} className={s.tipo === "importada" ? "text-purple-400" : "text-emerald-400"} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-800 truncate">{s.nombre}</div>
                                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                    <span className={s.tipo === "base" ? "text-emerald-500/80" : "text-purple-500/80"}>
                                                        {s.tipo === "base" ? "Base" : "Importada"}
                                                    </span>
                                                    {s.rows > 0 && (
                                                        <span>{s.rows} filas × {s.cols} cols</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-2 text-center text-[10px] text-gray-500">
                    Enter enviar · Shift+Enter nueva línea
                </div>
            </div>
        </aside>
    );
}
