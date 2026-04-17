// Types for Cuaderno de Explotación - Formato Oficial España
// Basado en: PABLO PEREZ RUBIO 2025 RESUELTO.XLSX

export type SheetType = "parcelas" | "productos" | "tratamientos" | "historico" | "fertilizantes" | "cosecha";

// ============================================
// PARCELA - Formato oficial SIGPAC
// ============================================
export interface Parcela {
    id: string;
    num_orden: number;                    // Nº de Orden
    // Referencias SIGPAC
    codigo_provincia: string;             // Código Provincia (ej: "37")
    termino_municipal: string;            // Término Municipal (ej: "108-COCA DE ALBA")
    codigo_agregado: string;              // Código Agregado
    zona: string;                         // Zona
    num_poligono: string;                 // Nº Polígono
    num_parcela: string;                  // Nº Parcela
    num_recinto: string;                  // Nº Recinto
    uso_sigpac: string;                   // Uso SIGPAC (ej: "TA")
    // Superficies
    superficie_sigpac: number;            // Superficie SIGPAC (ha)
    superficie_cultivada: number;         // Superficie Cultivada (ha)
    // Datos agronómicos
    especie: string;                      // Especie (ej: "CEBADA", "TRIGO BLANDO")
    variedad: string;                     // Variedad
    ecoregimen: string;                   // Ecoregimen/Práctica (ej: "P3", "P5")
    secano_regadio: string;               // S/R
    cultivo_tipo: string;                 // Principal/Secundario
    fecha_inicio_cultivo: string;         // Fecha inicio
    fecha_fin_cultivo: string;            // Fecha fin
    aire_libre_protegido: string;         // Aire libre o protegido
    sistema_asesoramiento: string;        // Sistema asesoramiento
    zona_nitratos: boolean;               // Zona vulnerable nitratos
    // Campos compatibilidad
    nombre: string;                       // Nombre descriptivo
    referencia_catastral: string;         // Ref. catastral completa
    superficie_ha: number;                // Superficie (alias)
    cultivo: string;                      // Cultivo (alias especie)
    municipio: string;                    // Municipio (alias termino_municipal)
    provincia: string;                    // Provincia
    notas?: string;
    activa: boolean;
    color_fila?: string;
}

// ============================================
// PRODUCTO FITOSANITARIO
// ============================================
export interface Producto {
    id: string;
    nombre_comercial: string;             // Nombre Comercial
    numero_registro: string;              // Nº Registro oficial
    materia_activa: string;               // Materia/Sustancia activa
    formulacion: string;                  // Formulación
    numero_lote: string;                  // Nº Lote
    cantidad_adquirida: number;           // Cantidad
    unidad: string;                       // L, Kg, etc.
    fecha_adquisicion?: string;           // Fecha compra
    fecha_caducidad?: string;             // Fecha caducidad
    proveedor?: string;                   // Proveedor
    color_fila?: string;
}

// ============================================
// PRODUCTO DEL CATÁLOGO GLOBAL (compartido entre cuadernos)
// ============================================
export interface CatalogoProducto {
    id: string;
    nombre_comercial: string;
    numero_registro: string;
    materia_activa: string;
    formulacion: string;
    tipo: string;           // fitosanitario | fertilizante | ...
    unidad: string;         // L, Kg, etc.
    proveedor: string;
    notas: string;
    created_at?: string;
    updated_at?: string;
}

// ============================================
// PRODUCTO APLICADO EN TRATAMIENTO
// ============================================
export interface ProductoAplicado {
    producto_id: string;
    nombre_comercial: string;
    numero_registro: string;              // Nº Registro
    problema_fitosanitario?: string;       // Problemática específica del producto
    dosis: number;                        // Dosis
    unidad_dosis: string;                 // kg/ha, l/ha, etc.
}

// ============================================
// TRATAMIENTO - Registro de actuaciones
// ============================================
export interface Tratamiento {
    id: string;
    // Identificación
    parcela_ids: string[];                // IDs de parcelas
    parcela_nombres: string[];            // Nombres de parcelas
    num_orden_parcelas: string;           // Nº orden parcelas (ej: "7,8,9")
    // Cultivo
    cultivo_especie: string;              // Especie (TRIGO BLANDO, CEBADA)
    cultivo_variedad: string;             // Variedad
    superficie_tratada: number;           // Superficie tratada (ha)
    // Aplicación
    fecha_aplicacion: string;             // Fecha
    problema_fitosanitario: string;       // Problema (MALAS HIERBAS, INSECTICIDA)
    aplicador: string;                    // ID/nombre aplicador
    equipo: string;                       // ID/nombre equipo
    // Producto
    productos: ProductoAplicado[];        // Productos aplicados
    // Resultado
    eficacia: string;                     // BUENA, REGULAR, MALA
    observaciones?: string;               // Observaciones
    // Estado
    estado: string;                       // Estado del tratamiento
    // Compatibilidad
    plaga_enfermedad: string;             // Alias
    metodo_aplicacion: string;
    operador: string;                     // Alias aplicador
    color_fila?: string;                  // Color de fondo (hex) para marcar la fila
}

// ============================================
// FERTILIZACIÓN
// ============================================
export interface Fertilizacion {
    id: string;
    fecha_inicio: string;
    fecha_fin: string;
    num_orden_parcelas: string;
    cultivo_especie: string;
    cultivo_variedad: string;
    tipo_abono: string;                   // Tipo de abono/producto
    riqueza_npk: string;                  // Riqueza N/P/K
    dosis: string;                        // Dosis (kg/ha, m3/ha)
    tipo_fertilizacion: string;           // Tipo
    observaciones?: string;
    color_fila?: string;
}

// ============================================
// COSECHA
// ============================================
export interface Cosecha {
    id: string;
    fecha: string;
    producto: string;
    cantidad_kg: number;
    num_orden_parcelas: string;
    num_albaran: string;
    num_lote: string;
    cliente_nombre: string;
    cliente_nif: string;
    cliente_direccion: string;
    cliente_rgseaa: string;
    color_fila?: string;
}

// ============================================
// HISTÓRICO
// ============================================
export interface HistoricoRow {
    fecha: string;
    parcelas: string;
    producto: string;
    num_registro: string;
    num_lote: string;
    dosis: string;
    plaga: string;
    operador?: string;
    observaciones?: string;
    estado?: string;
    id?: string;
}

// ============================================
// HOJA EXCEL IMPORTADA (todo entra, se ve, se edita, se conserva)
// ============================================
export interface HojaExcel {
    sheet_id: string;
    nombre: string;
    columnas: string[];
    datos: any[][];
    tipo: "parcelas" | "productos" | "tratamientos" | "fertilizantes" | "cosecha" | "custom";
    origen?: "importado" | "importado_editable";
}

// ============================================
// CUADERNO DE EXPLOTACIÓN
// ============================================
export interface Cuaderno {
    id: string;
    nombre_explotacion: string;
    titular: string;
    nif_titular: string;
    domicilio: string;
    codigo_explotacion: string;
    año: number;
    fecha_apertura?: string;
    parcelas: Parcela[];
    productos: Producto[];
    tratamientos: Tratamiento[];
    fertilizaciones?: Fertilizacion[];
    cosechas?: Cosecha[];
    hojas_originales?: HojaExcel[];
}

export interface CuadernoSummary {
    id: string;
    nombre_explotacion: string;
    titular?: string;
    año: number;
    num_parcelas: number;
    num_tratamientos: number;
}

export interface Carpeta {
    id: string;
    nombre: string;
    parent_id: string | null;
    orden: number;
}

// ============================================
// SELECCIÓN DE CELDAS (para Chat IA)
// ============================================
export interface CellSelection {
    sheetId: string;          // "parcelas" | "productos" | ... | UUID de hoja importada
    sheetName: string;        // Nombre legible de la hoja
    rows: {
        rowId: string;        // entity ID o índice
        rowIndex: number;     // índice visual
        cells: {
            colKey: string;   // key de columna o índice
            colLabel: string; // label legible
            value: any;       // valor actual
        }[];
    }[];
}

// ============================================
// CHAT (sesiones por cuaderno)
// ============================================
export interface ChatMessage {
    role: "assistant" | "user";
    content: string;
    createdAt?: number;
    action?: string;
    datos?: Record<string, unknown>;
    sugerencias?: string[];
    isLoading?: boolean;
    /** Para mensajes de preview de reemplazo: [Aplicar] [Cancelar] */
    replaceFrom?: string;
    replaceTo?: string;
    /** Contexto de selección de celdas adjunta al mensaje */
    selectionContext?: CellSelection;
    /** Resumen del contexto enviado al backend para este mensaje */
    contextMeta?: {
        activeSheetId?: string;
        activeSheetName?: string;
        selectedRows?: number;
        selectedCells?: number;
    };
}

export interface ChatSession {
    id: string;
    cuadernoId: string | null;
    messages: ChatMessage[];
}

// ============================================
// CONFIGURACIÓN DE COLUMNAS - Formato Oficial
// ============================================
export interface ColumnConfig {
    key: string;
    label: string;
    width: number;
    editable?: boolean;
    type?: "text" | "number" | "date";
}

export const SHEET_CONFIG: Record<SheetType, {
    title: string;
    columns: ColumnConfig[];
}> = {
    parcelas: {
        title: "2.1 Datos Parcelas",
        columns: [
            { key: "num_orden", label: "Nº Orden", width: 70, type: "number" },
            { key: "codigo_provincia", label: "Prov.", width: 50, editable: true },
            { key: "nombre", label: "Nombre", width: 140, editable: true },
            { key: "termino_municipal", label: "Término Municipal", width: 150, editable: true },
            { key: "num_poligono", label: "Polígono", width: 70, editable: true },
            { key: "num_parcela", label: "Parcela", width: 70, editable: true },
            { key: "num_recinto", label: "Recinto", width: 60, editable: true },
            { key: "uso_sigpac", label: "Uso", width: 50 },
            { key: "superficie_sigpac", label: "Sup. SIGPAC", width: 90, type: "number" },
            { key: "superficie_cultivada", label: "Sup. Cultivada", width: 100, type: "number" },
            { key: "especie", label: "Cultivo", width: 120, editable: true },
            { key: "ecoregimen", label: "Ecoreg.", width: 60 },
            { key: "secano_regadio", label: "S/R", width: 40 },
            { key: "zona_nitratos", label: "Zonas vuln.", width: 90, editable: true },
        ],
    },
    productos: {
        title: "Productos Fitosanitarios",
        columns: [
            { key: "nombre_comercial", label: "Nombre Comercial", width: 180, editable: true },
            { key: "numero_registro", label: "Nº Registro", width: 100, editable: true },
            { key: "materia_activa", label: "Materia Activa", width: 160, editable: true },
            { key: "numero_lote", label: "Lote", width: 100, editable: true },
            { key: "cantidad_adquirida", label: "Cantidad", width: 80, type: "number" },
            { key: "unidad", label: "Ud", width: 50 },
            { key: "fecha_adquisicion", label: "F. Adquisición", width: 110, type: "date" },
        ],
    },
    tratamientos: {
        title: "3.1 Registro Tratamientos",
        columns: [
            { key: "num_orden_parcelas", label: "Nº Parcela", width: 80 },
            { key: "cultivo_especie", label: "Cultivo", width: 110, editable: true },
            { key: "superficie_tratada", label: "Sup. (ha)", width: 80, type: "number", editable: true },
            { key: "fecha_aplicacion", label: "Fecha", width: 100, type: "date", editable: true },
            { key: "problema_fitosanitario", label: "Problemática", width: 120, editable: true },
            { key: "aplicador", label: "Aplicador", width: 80, editable: true },
            { key: "equipo", label: "Equipo", width: 70, editable: true },
            { key: "nombre_comercial", label: "Producto", width: 140, editable: true },
            { key: "numero_registro", label: "Nº Registro", width: 90, editable: true },
            { key: "dosis", label: "Dosis", width: 100, type: "text", editable: true },
            { key: "eficacia", label: "Eficacia", width: 70, editable: true },
        ],
    },
    historico: {
        title: "Histórico Completo",
        columns: [
            { key: "fecha", label: "Fecha", width: 100 },
            { key: "parcelas", label: "Parcela(s)", width: 100 },
            { key: "producto", label: "Producto", width: 140 },
            { key: "num_registro", label: "Nº Reg.", width: 80 },
            { key: "num_lote", label: "Nº Lote", width: 80 },
            { key: "dosis", label: "Dosis", width: 80 },
            { key: "plaga", label: "Problema", width: 120 },
            { key: "operador", label: "Operador", width: 90 },
            { key: "observaciones", label: "Observaciones", width: 150 },
            { key: "estado", label: "Estado", width: 80 },
        ],
    },
    fertilizantes: {
        title: "Registro Fertilizantes",
        columns: [
            { key: "fecha_inicio", label: "Mes Inicio", width: 100 },
            { key: "fecha_fin", label: "Mes Fin", width: 100 },
            { key: "num_orden_parcelas", label: "Parcelas", width: 80 },
            { key: "cultivo_especie", label: "Cultivo", width: 120 },
            { key: "tipo_abono", label: "Tipo Abono", width: 150, editable: true },
            { key: "riqueza_npk", label: "N/P/K", width: 80 },
            { key: "dosis", label: "Dosis", width: 100 },
            { key: "tipo_fertilizacion", label: "Tipo", width: 100 },
        ],
    },
    cosecha: {
        title: "Registro Cosecha",
        columns: [
            { key: "fecha", label: "Fecha", width: 100, type: "date" },
            { key: "producto", label: "Producto", width: 120 },
            { key: "cantidad_kg", label: "Cantidad (kg)", width: 100, type: "number" },
            { key: "num_orden_parcelas", label: "Parcelas", width: 80 },
            { key: "num_albaran", label: "Albarán", width: 100 },
            { key: "num_lote", label: "Lote", width: 80 },
            { key: "cliente_nombre", label: "Cliente", width: 150 },
        ],
    },
};
