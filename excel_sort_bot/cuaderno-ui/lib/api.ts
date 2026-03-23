// API client for Cuaderno de Explotación v2.0
// Con soporte para upload de archivos y procesamiento GPT-4o

function getApiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return `${process.env.NEXT_PUBLIC_API_URL}/api/cuaderno`;
    }
    // next dev: el navegador llama al Python directamente (evita fallos del proxy Next→localhost/IPv6).
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        const h = window.location.hostname;
        if (h === "localhost" || h === "127.0.0.1") {
            return "http://127.0.0.1:8000/api/cuaderno";
        }
    }
    // Vercel / producción: SIEMPRE mismo origen (/api/cuaderno). Si el navegador llama directo a Render y
    // Render devuelve 502/503, la respuesta no lleva CORS y parece "blocked by CORS policy".
    return "/api/cuaderno";
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Increase timeout for chat operations (AI can take time)
    const isChatOperation = endpoint.includes('/chat/execute');
    const timeout = isChatOperation ? 300000 : 30000; // 5 min for chat, 30s for others

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const method = (options.method ?? "GET").toUpperCase();
    const optHeaders = options.headers as Record<string, string> | undefined;
    const headers: Record<string, string> = { ...optHeaders };
    // GET/HEAD sin cuerpo: sin Content-Type → petición CORS "simple" (evita preflight fallido tras cold start / proxy).
    if (method !== "GET" && method !== "HEAD") {
        const hasBody = options.body != null && options.body !== "";
        if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/json";
        }
    }

    try {
        const res = await fetch(`${getApiBase()}${endpoint}`, {
            ...options,
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Read the body once as text, then parse
        const text = await res.text();
        let data: any;
        try {
            data = JSON.parse(text);
        } catch {
            if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
            throw new Error(text || "Respuesta no válida del servidor");
        }

        if (!res.ok) {
            throw new Error(data.detail || data.mensaje || `HTTP ${res.status}`);
        }

        return data as T;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error("La operación tardó demasiado. Por favor, intenta de nuevo.");
        }
        if (error.message?.includes('fetch') || error.message?.includes('NetworkError') || error.message?.includes('Failed')) {
            throw new Error("Error de conexión con el servidor. Verifica que el backend esté corriendo.");
        }
        throw error;
    }
}

/** Subidas Excel/PDF grandes: el servidor puede tardar varios minutos en leer y procesar. */
const UPLOAD_TIMEOUT_MS = 900_000; // 15 min

// Upload helper sin Content-Type (para FormData)
async function uploadFile<T>(endpoint: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
        const res = await fetch(`${getApiBase()}${endpoint}`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "Error procesando archivo" }));
            throw new Error(error.detail || "Error en upload");
        }

        return res.json();
    } catch (e: any) {
        if (e?.name === "AbortError") {
            throw new Error(
                "La subida o el análisis tardaron demasiado (límite 15 min). Si el archivo es enorme, prueba en red estable o reduce el tamaño."
            );
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

// Upload con opciones (solo_datos, hojas_seleccionadas)
async function uploadFileWithOptions<T>(
    endpoint: string,
    file: File,
    options?: { solo_datos?: boolean; hojas_seleccionadas?: number[] }
): Promise<T> {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.solo_datos) {
        formData.append("solo_datos", "true");
    }
    if (options?.hojas_seleccionadas?.length) {
        formData.append("hojas_seleccionadas", JSON.stringify(options.hojas_seleccionadas));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
        const res = await fetch(`${getApiBase()}${endpoint}`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "Error procesando archivo" }));
            throw new Error(error.detail || "Error en upload");
        }

        return res.json();
    } catch (e: any) {
        if (e?.name === "AbortError") {
            throw new Error(
                "La subida o el análisis tardaron demasiado (límite 15 min). Si el archivo es enorme, prueba en red estable o reduce el tamaño."
            );
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

export interface HojaResumen {
    indice: number;
    nombre: string;
    vacia: boolean;
    num_filas: number;
}

export interface UploadAnalysisResult {
    success: boolean;
    filename: string;
    file_type: string;
    data: {
        hojas?: Array<{
            nombre: string;
            columnas: string[];
            datos: any[][];
            num_filas?: number;
        }>;
        analisis_ia?: {
            tipo_documento?: string;
            datos_explotacion?: {
                nombre?: string;
                titular?: string;
                nif?: string;
                direccion?: string;
            };
            parcelas?: Array<{
                nombre: string;
                referencia_catastral?: string;
                superficie_ha?: number;
                cultivo?: string;
            }>;
            productos?: Array<{
                nombre_comercial: string;
                numero_registro?: string;
                materia_activa?: string;
            }>;
        };
    };
    hojas_resumen?: HojaResumen[];
}

export interface CreateFromFileResult {
    success: boolean;
    cuaderno_id: string;
    nombre: string;
    parcelas_creadas: number;
    productos_creados: number;
    tratamientos_creados?: number;
    hojas_originales?: number;
    datos_extraidos: any;
    message: string;
}

// Respuesta del Chat IA
export interface ChatResponse {
    success: boolean;
    mensaje: string;
    accion_ejecutada?: string;
    datos_creados?: Record<string, any>;
    sugerencias?: string[];
    elementos_no_procesados?: string[];  // Cosas que no se entendieron o no están en el sistema
    advertencias?: string[];  // Advertencias sobre datos inferidos o por defecto
}

export const api = {
    // Cuadernos
    listCuadernos: () => request<{ cuadernos: any[] }>("/catalog/cuadernos"),

    getCuaderno: (id: string) => request<{ cuaderno: any }>(`/${id}`),

    updateHoja: (cuadernoId: string, sheetId: string, data: { datos?: any[][]; columnas?: string[]; nombre?: string }) =>
        request<{ success: boolean; hoja: any }>(`/${cuadernoId}/hojas/${sheetId}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    /** Edición atómica: una celda. Sin enviar la hoja entera. */
    patchCell: (
        cuadernoId: string,
        data: { sheet_id: string; row: number | string; column: number | string; value: any }
    ) =>
        request<{ success: boolean; timestamp: string }>(`/${cuadernoId}/cell`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    deleteHoja: (cuadernoId: string, sheetId: string) =>
        request<{ success: boolean }>(`/${cuadernoId}/hojas/${sheetId}`, {
            method: "DELETE",
        }),

    renameHoja: (cuadernoId: string, sheetId: string, nombre: string) =>
        request<{ success: boolean; nombre: string }>(`/${cuadernoId}/hojas/${sheetId}/rename`, {
            method: "PATCH",
            body: JSON.stringify({ nombre }),
        }),

    createCuaderno: (data: any) =>
        request<{ cuaderno_id: string }>("/create", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    deleteCuaderno: (cuadernoId: string) =>
        request<{ success: boolean; message: string }>(`/${cuadernoId}`, {
            method: "DELETE",
        }),

    // Parcelas
    createParcela: (cuadernoId: string, data: any) =>
        request<{ parcela: any }>(`/${cuadernoId}/parcelas`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    deleteParcela: (cuadernoId: string, parcelaId: string) =>
        request<{ success: boolean }>(`/${cuadernoId}/parcelas/${parcelaId}`, {
            method: "DELETE",
        }),

    // Productos
    createProducto: (cuadernoId: string, data: any) =>
        request<{ producto: any }>(`/${cuadernoId}/productos`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    deleteProducto: (cuadernoId: string, productoId: string) =>
        request<{ success: boolean }>(`/${cuadernoId}/productos/${productoId}`, {
            method: "DELETE",
        }),

    // Tratamientos
    createTratamiento: (cuadernoId: string, data: any) =>
        request<{ tratamiento: any }>(`/${cuadernoId}/tratamientos`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    createFertilizacion: (cuadernoId: string, data: any) =>
        request<{ fertilizacion: any }>(`/${cuadernoId}/fertilizaciones`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    createCosecha: (cuadernoId: string, data: any) =>
        request<{ cosecha: any }>(`/${cuadernoId}/cosechas`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    getTratamiento: (cuadernoId: string, tratamientoId: string) =>
        request<{ tratamiento: any }>(`/${cuadernoId}/tratamientos/${tratamientoId}`),

    updateTratamiento: (cuadernoId: string, tratamientoId: string, data: any) =>
        request<{ tratamiento: any }>(`/${cuadernoId}/tratamientos/${tratamientoId}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteTratamiento: (cuadernoId: string, tratamientoId: string) =>
        request<{ success: boolean }>(`/${cuadernoId}/tratamientos/${tratamientoId}`, {
            method: "DELETE",
        }),

    duplicarTratamiento: (cuadernoId: string, tratamientoId: string) =>
        request<{ tratamiento: any }>(`/${cuadernoId}/tratamientos/${tratamientoId}/duplicar`, {
            method: "POST",
        }),

    copiarTratamientoAParcelas: (cuadernoId: string, tratamientoId: string, parcelaIds: string[]) =>
        request<{ tratamientos: any[]; message: string }>(`/${cuadernoId}/tratamientos/${tratamientoId}/copiar-a-parcelas`, {
            method: "POST",
            body: JSON.stringify({ parcela_ids: parcelaIds }),
        }),

    // Histórico canónico (filtros: parcela, fechas, producto, lote)
    getHistorico: (
        cuadernoId: string,
        params?: { parcela_id?: string; date_from?: string; date_to?: string; product_id?: string; num_lote?: string }
    ) => {
        const search = new URLSearchParams();
        if (params?.parcela_id) search.set("parcela_id", params.parcela_id);
        if (params?.date_from) search.set("date_from", params.date_from);
        if (params?.date_to) search.set("date_to", params.date_to);
        if (params?.product_id) search.set("product_id", params.product_id);
        if (params?.num_lote) search.set("num_lote", params.num_lote);
        const q = search.toString();
        return request<{ historico: any[]; total: number }>(
            `/${cuadernoId}/historico${q ? `?${q}` : ""}`
        );
    },

    // Export PDF (opcional: periodo, orden, check flags)
    getExportPDFUrl: (cuadernoId: string, params?: { desde?: string; hasta?: string; check_hojas_editadas?: boolean; incluir_hojas?: string; orden_parcelas?: string; orden_tratamientos?: string; orden_parcelas_modo?: string }) => {
        const search = new URLSearchParams();
        if (params?.desde) search.set("desde", params.desde);
        if (params?.hasta) search.set("hasta", params.hasta);
        if (params?.check_hojas_editadas) search.set("check_hojas_editadas", "true");
        if (params?.incluir_hojas !== undefined) search.set("incluir_hojas", params.incluir_hojas);
        if (params?.orden_parcelas) search.set("orden_parcelas", params.orden_parcelas);
        if (params?.orden_tratamientos) search.set("orden_tratamientos", params.orden_tratamientos);
        if (params?.orden_parcelas_modo) search.set("orden_parcelas_modo", params.orden_parcelas_modo);
        const q = search.toString();
        return `${getApiBase()}/${cuadernoId}/export/pdf${q ? `?${q}` : ""}`;
    },

    // Export Excel (opcional: periodo, orden, check flags)
    getExportExcelUrl: (cuadernoId: string, params?: { desde?: string; hasta?: string; check_hojas_editadas?: boolean; incluir_hojas?: string; orden_parcelas?: string; orden_tratamientos?: string; orden_parcelas_modo?: string }) => {
        const search = new URLSearchParams();
        if (params?.desde) search.set("desde", params.desde);
        if (params?.hasta) search.set("hasta", params.hasta);
        if (params?.check_hojas_editadas) search.set("check_hojas_editadas", "true");
        if (params?.incluir_hojas !== undefined) search.set("incluir_hojas", params.incluir_hojas);
        if (params?.orden_parcelas) search.set("orden_parcelas", params.orden_parcelas);
        if (params?.orden_tratamientos) search.set("orden_tratamientos", params.orden_tratamientos);
        if (params?.orden_parcelas_modo) search.set("orden_parcelas_modo", params.orden_parcelas_modo);
        const q = search.toString();
        return `${getApiBase()}/${cuadernoId}/export/excel${q ? `?${q}` : ""}`;
    },

    // Export Excel como descarga (fetch + blob) - más fiable que window.open
    downloadExportExcel: async (cuadernoId: string, params?: { desde?: string; hasta?: string; incluir_hojas?: string; orden_parcelas?: string; orden_tratamientos?: string; orden_parcelas_modo?: string }) => {
        const url = getApiBase();
        const search = new URLSearchParams();
        if (params?.desde) search.set("desde", params.desde);
        if (params?.hasta) search.set("hasta", params.hasta);
        if (params?.incluir_hojas !== undefined) search.set("incluir_hojas", params.incluir_hojas);
        if (params?.orden_parcelas) search.set("orden_parcelas", params.orden_parcelas);
        if (params?.orden_tratamientos) search.set("orden_tratamientos", params.orden_tratamientos);
        if (params?.orden_parcelas_modo) search.set("orden_parcelas_modo", params.orden_parcelas_modo);
        const q = search.toString();
        const fullUrl = `${url}/${cuadernoId}/export/excel${q ? `?${q}` : ""}`;
        const res = await fetch(fullUrl, { credentials: "include" });
        if (!res.ok) throw new Error("Error al exportar Excel");
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        let filename = "Cuaderno_export.xlsx";
        if (disposition) {
            const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match) filename = match[1].replace(/['"]/g, "").trim();
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    // Histórico de tratamientos de una parcela
    getHistoricoParcela: (cuadernoId: string, parcelaId: string) =>
        request<{ parcela: any; tratamientos: any[]; total: number }>(
            `/${cuadernoId}/parcelas/${parcelaId}/historico`
        ),

    // ============================================
    // CHAT IA - COMANDOS INTELIGENTES
    // ============================================

    // Ejecutar comando de chat
    executeChat: (cuadernoId: string, mensaje: string, contexto?: Record<string, any>) =>
        request<ChatResponse>(`/${cuadernoId}/chat/execute`, {
            method: "POST",
            body: JSON.stringify({
                cuaderno_id: cuadernoId,
                mensaje,
                contexto
            }),
        }),

    // ============================================
    // UPLOAD Y PROCESAMIENTO DE ARCHIVOS
    // ============================================

    // Analizar archivo (sin crear cuaderno)
    analyzeFile: (file: File) =>
        uploadFile<UploadAnalysisResult>("/upload/analyze", file),

    // Crear cuaderno desde archivo (opciones: solo datos o hojas seleccionadas)
    createFromFile: (file: File, options?: { solo_datos?: boolean; hojas_seleccionadas?: number[] }) =>
        uploadFileWithOptions<CreateFromFileResult>("/upload/create-from-file", file, options),

    // Importar datos a cuaderno existente
    importToExisting: (cuadernoId: string, file: File) =>
        uploadFile<{
            success: boolean;
            parcelas_añadidas: number;
            productos_añadidos: number;
            message: string;
        }>(`/${cuadernoId}/upload/import`, file),

    // Formatos soportados
    getSupportedFormats: () =>
        request<{
            formatos: Record<string, { extensiones: string[]; descripcion: string }>;
            capacidades: string[];
        }>("/upload/supported-formats"),
};

