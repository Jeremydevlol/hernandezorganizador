"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Editor, { type EditorActions } from "@/components/Editor";
import ChatPanel from "@/components/ChatPanel";
import WelcomeScreen from "@/components/WelcomeScreen";
import { Cuaderno, SheetType, ChatMessage, ChatSession, CellSelection } from "@/lib/types";
import { api } from "@/lib/api";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  createdAt: Date.now(),
  content: `👋 Hola! Soy VIera AI, tu asistente del Cuaderno de Explotación Agrícola.

Puedo ejecutar acciones por ti:
• Añadir parcelas y productos
• Registrar tratamientos fitosanitarios
• Generar informes y exportar datos

**Ejemplo:** "Añade una parcela llamada Huerta Norte de 5 ha con olivos"`,
};

function newSessionId() {
  return "chat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

const CHAT_SESSIONS_STORAGE_KEY = "cuaderno_ui_chat_sessions_v1";
const CHAT_ACTIVE_STORAGE_KEY = "cuaderno_ui_active_chat_id_v1";

export default function Home() {
  const [cuadernos, setCuadernos] = useState<Cuaderno[]>([]);
  const [activeCuaderno, setActiveCuaderno] = useState<Cuaderno | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetType>("parcelas");
  const [focusSheetId, setFocusSheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const editorActionsRef = useRef<EditorActions | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [highlight, setHighlight] = useState<{ sheet: SheetType; id: string } | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(260);
  const [rightWidth, setRightWidth] = useState<number>(320);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const [pendingSelection, setPendingSelection] = useState<CellSelection | null>(null);

  // Sesiones de chat: cada una ligada a un cuaderno; varias pueden ser del mismo cuaderno
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => [
    { id: newSessionId(), cuadernoId: null, messages: [INITIAL_MESSAGE] },
  ]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawSessions = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      const rawActive = window.localStorage.getItem(CHAT_ACTIVE_STORAGE_KEY);
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatSessions(parsed);
          setActiveChatId(rawActive || parsed[0]?.id || null);
        }
      }
    } catch (e) {
      console.error("Error loading chat history from localStorage:", e);
    } finally {
      setChatHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(chatSessions));
      if (activeChatId) window.localStorage.setItem(CHAT_ACTIVE_STORAGE_KEY, activeChatId);
    } catch (e) {
      console.error("Error saving chat history to localStorage:", e);
    }
  }, [chatHydrated, chatSessions, activeChatId]);

  useEffect(() => {
    if (activeChatId === null && chatSessions.length > 0) {
      setActiveChatId(chatSessions[0].id);
    }
  }, [activeChatId, chatSessions.length]);

  const activeSession = activeChatId
    ? chatSessions.find((s) => s.id === activeChatId)
    : chatSessions[0] ?? null;

  useEffect(() => {
    loadCuadernos();
  }, []);

  // Listeners globales para redimensionar paneles con el ratón
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging === "left") {
        const min = 200;
        const max = 500;
        const newWidth = Math.min(Math.max(e.clientX, min), max);
        setLeftWidth(newWidth);
      } else if (dragging === "right") {
        const min = 260;
        const max = 520;
        const viewportWidth = window.innerWidth;
        const newWidth = Math.min(Math.max(viewportWidth - e.clientX, min), max);
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const loadCuadernos = useCallback(async () => {
    try {
      const data = await api.listCuadernos();
      setCuadernos(data.cuadernos || []);
    } catch (error) {
      console.error("Error loading cuadernos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCuaderno = useCallback(async (id: string) => {
    try {
      const data = await api.getCuaderno(id);
      setActiveCuaderno(data.cuaderno);
      let sessionToActivate: string | null = null;
      setChatSessions((prev) => {
        const exists = prev.find((s) => s.cuadernoId === id);
        if (exists) {
          sessionToActivate = exists.id;
          return prev;
        }
        const newSession: ChatSession = {
          id: newSessionId(),
          cuadernoId: id,
          messages: [INITIAL_MESSAGE, {
            role: "assistant",
            content: `📂 Cuaderno **"${data.cuaderno.nombre_explotacion}"** cargado.\n\n¿Qué quieres hacer?`,
          }],
        };
        sessionToActivate = newSession.id;
        return [...prev, newSession];
      });
      if (sessionToActivate) setActiveChatId(sessionToActivate);
    } catch (error) {
      console.error("Error loading cuaderno:", error);
    }
  }, []);

  const createCuaderno = async (data: Partial<Cuaderno>) => {
    try {
      const result = await api.createCuaderno(data);
      await loadCuadernos();
      await selectCuaderno(result.cuaderno_id);
    } catch (error) {
      console.error("Error creating cuaderno:", error);
    }
  };

  /** Tras subir archivo: refrescar lista en tiempo real y abrir el cuaderno */
  const onUploadSuccess = useCallback(async (id: string) => {
    await loadCuadernos();
    await selectCuaderno(id);
  }, [loadCuadernos, selectCuaderno]);

  const refreshData = async () => {
    if (activeCuaderno?.id) {
      await selectCuaderno(activeCuaderno.id);
    }
  };

  /** Nuevo chat: mismo cuaderno actual (o sin cuaderno si no hay ninguno seleccionado) */
  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: newSessionId(),
      cuadernoId: activeCuaderno?.id ?? null,
      messages: activeCuaderno
        ? [INITIAL_MESSAGE, {
          role: "assistant",
          content: `📂 Nuevo chat para **"${activeCuaderno.nombre_explotacion}"**.\n\n¿Qué quieres hacer?`,
        }]
        : [INITIAL_MESSAGE],
    };
    setChatSessions((prev) => [...prev, newSession]);
    setActiveChatId(newSession.id);
  }, [activeCuaderno]);

  /** Al cambiar de pestaña de chat: si el chat es de otro cuaderno, cambiar el cuaderno mostrado */
  const handleSelectChat = useCallback((sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (!session) return;
    setActiveChatId(sessionId);
    if (session.cuadernoId && session.cuadernoId !== activeCuaderno?.id) {
      selectCuaderno(session.cuadernoId);
    }
  }, [chatSessions, activeCuaderno?.id, selectCuaderno]);

  const setActiveSessionMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (!activeChatId) return;
    setChatSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id === activeChatId) {
          const next = typeof updater === "function" ? updater(s.messages) : updater;
          return { ...s, messages: next };
        }
        return s;
      })
    );
  }, [activeChatId]);

  const handleSendSelectionToChat = useCallback((selection: CellSelection) => {
    setPendingSelection(selection);
    setChatOpen(true);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-darker)]">
      {/* Header — barra superior limpia */}
      <header className="h-12 shrink-0 flex items-center gap-0.5 pl-[72px] pr-4 border-b border-white/5 bg-[var(--bg-dark)]/80 backdrop-blur-sm electron-drag">
        <button
          type="button"
          onClick={() => setLeftSidebarOpen((v) => !v)}
          title={leftSidebarOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
          className={`p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors electron-no-drag ${leftSidebarOpen ? "text-emerald-400" : ""}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="1" />
            <rect x="2" y="3" width="6" height="18" rx="0.5" fill="currentColor" fillOpacity="0.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          title={chatOpen ? "Ocultar panel derecho (Chat)" : "Mostrar panel derecho (Chat)"}
          className={`p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors electron-no-drag ${chatOpen ? "text-emerald-400" : ""}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="1" />
            <rect x="16" y="3" width="6" height="18" rx="0.5" fill="currentColor" fillOpacity="0.5" />
          </svg>
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar izquierdo + resizer (ocultable) */}
        {leftSidebarOpen && (
          <div className="flex h-full" style={{ width: leftWidth }}>
            <Sidebar
              cuadernos={cuadernos}
              activeCuaderno={activeCuaderno}
              activeSheet={activeSheet}
              loading={loading}
              onSelectCuaderno={selectCuaderno}
              onSelectSheet={setActiveSheet}
              onCreateCuaderno={createCuaderno}
              onUploadSuccess={onUploadSuccess}
              onCuadernoDeleted={async () => {
                await loadCuadernos();
                if (activeCuaderno && !cuadernos.find(c => c.id === activeCuaderno.id)) {
                  setActiveCuaderno(null);
                }
              }}
            />
            <div
              onMouseDown={() => setDragging("left")}
              className="w-1 cursor-col-resize bg-zinc-900 hover:bg-zinc-700 transition-colors"
            />
          </div>
        )}

        {/* Área central */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeCuaderno ? (
            <Editor
              cuaderno={activeCuaderno}
              activeSheet={activeSheet}
              onSheetChange={setActiveSheet}
              onRefresh={refreshData}
              highlight={highlight}
              onRequestHighlight={(sheet, id) => setHighlight({ sheet, id })}
              focusSheetId={focusSheetId}
              onFocusModeExit={() => setFocusSheetId(null)}
              editorActionsRef={editorActionsRef}
              onSendSelectionToChat={handleSendSelectionToChat}
            />
          ) : (
            <WelcomeScreen onCreateCuaderno={createCuaderno} />
          )}
        </main>

        {/* Chat Panel + resizer (ocultable) */}
        {chatOpen && (
          <div className="flex h-full" style={{ width: rightWidth }}>
            <div
              onMouseDown={() => setDragging("right")}
              className="w-1 cursor-col-resize bg-zinc-900 hover:bg-zinc-700 transition-colors"
            />
            <ChatPanel
              cuaderno={activeCuaderno}
              messages={activeSession?.messages ?? [INITIAL_MESSAGE]}
              onMessagesChange={setActiveSessionMessages}
              sessions={chatSessions}
              activeSessionId={activeChatId}
              onSelectSession={handleSelectChat}
              onNewChat={handleNewChat}
              onClose={() => setChatOpen(false)}
              onRefresh={refreshData}
              onNavigate={(nav) => {
                setActiveSheet(nav.sheet);
                setHighlight({ sheet: nav.sheet, id: nav.id });
              }}
              focusSheetId={focusSheetId}
              onSelectSheetFromChat={(sheetId) => {
                setFocusSheetId(sheetId);
                const base: SheetType[] = ["parcelas", "productos", "tratamientos", "fertilizantes", "cosecha", "historico"];
                if (base.includes(sheetId as SheetType)) setActiveSheet(sheetId as SheetType);
              }}
              onFocusModeExit={() => setFocusSheetId(null)}
              editorActionsRef={editorActionsRef}
              pendingSelection={pendingSelection}
              onSelectionConsumed={() => setPendingSelection(null)}
            />
          </div>
        )}
      </div>

      {/* Botón flotante para abrir chat si está cerrado */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed right-4 bottom-4 w-12 h-12 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center shadow-lg transition-all"
          title="Abrir Chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
