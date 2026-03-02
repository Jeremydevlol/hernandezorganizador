"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, FileImage, FileText, X, Check, Loader2, Sparkles } from "lucide-react";
import { api, CreateFromFileResult, UploadAnalysisResult } from "@/lib/api";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (cuadernoId: string) => void;
}

type UploadState = "idle" | "uploading" | "analyzing" | "confirm_import" | "creating" | "success" | "error";

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
    const [state, setState] = useState<UploadState>("idle");
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<UploadAnalysisResult | null>(null);
    const [result, setResult] = useState<CreateFromFileResult | null>(null);
    const [error, setError] = useState<string>("");
    const [hojasSeleccionadas, setHojasSeleccionadas] = useState<number[]>([]);

    const ACCEPTED_TYPES = [
        ".xlsx", ".xls", ".xlsm",
        ".pdf",
        ".png", ".jpg", ".jpeg", ".webp",
        ".csv"
    ];

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFile = (file: File) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_TYPES.includes(ext)) {
            setError(`Formato no soportado: ${ext}. Usa Excel, PDF, imágenes o CSV.`);
            return;
        }
        setSelectedFile(file);
        setError("");
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const processFile = async () => {
        if (!selectedFile) return;

        setState("uploading");
        setError("");

        try {
            setState("analyzing");
            const response = await api.analyzeFile(selectedFile) as UploadAnalysisResult;

            if (response.success && response.data) {
                setAnalysisResult(response);
                const hojas = response.hojas_resumen || [];
                setHojasSeleccionadas(hojas.map((h) => h.indice));
                setState("confirm_import");
            } else {
                throw new Error("Error analizando archivo");
            }
        } catch (err: any) {
            setError(err.message || "Error procesando archivo");
            setState("error");
        }
    };

    const confirmCreate = async (soloDatos: boolean) => {
        if (!selectedFile) return;

        setState("creating");
        setError("");

        try {
            const options = soloDatos
                ? { solo_datos: true }
                : { hojas_seleccionadas: hojasSeleccionadas };
            const response = await api.createFromFile(selectedFile, options);

            if (response.success) {
                setResult(response);
                setState("success");
                setTimeout(() => {
                    onSuccess(response.cuaderno_id);
                    resetModal();
                }, 1500);
            } else {
                throw new Error("Error creando cuaderno");
            }
        } catch (err: any) {
            setError(err.message || "Error creando cuaderno");
            setState("error");
        }
    };

    const toggleHoja = (indice: number) => {
        setHojasSeleccionadas((prev) =>
            prev.includes(indice) ? prev.filter((i) => i !== indice) : [...prev, indice]
        );
    };

    const handleSuccess = () => {
        if (result?.cuaderno_id) {
            onSuccess(result.cuaderno_id);
            resetModal();
        }
    };

    const resetModal = () => {
        setState("idle");
        setSelectedFile(null);
        setAnalysisResult(null);
        setResult(null);
        setError("");
        setHojasSeleccionadas([]);
    };

    const getFileIcon = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase();
        if (["xlsx", "xls", "xlsm", "csv"].includes(ext || "")) {
            return <FileSpreadsheet className="w-8 h-8 text-green-400" />;
        }
        if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
            return <FileImage className="w-8 h-8 text-blue-400" />;
        }
        if (ext === "pdf") {
            return <FileText className="w-8 h-8 text-red-400" />;
        }
        return <FileText className="w-8 h-8 text-zinc-400" />;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Sparkles size={20} className="text-green-500" />
                        <h2 className="text-lg font-semibold text-zinc-100">
                            Importar Cuaderno
                        </h2>
                    </div>
                    <button
                        onClick={() => { onClose(); resetModal(); }}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {state === "idle" && !selectedFile && (
                        <>
                            {/* Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${dragActive
                                    ? "border-green-500 bg-green-500/10"
                                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50"
                                    }`}
                            >
                                <input
                                    type="file"
                                    accept={ACCEPTED_TYPES.join(",")}
                                    onChange={handleFileInput}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />

                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                                        <Upload className="w-8 h-8 text-green-500" />
                                    </div>
                                    <p className="text-zinc-200 font-medium mb-1">
                                        Arrastra un archivo aquí
                                    </p>
                                    <p className="text-sm text-zinc-500">
                                        o haz clic para seleccionar
                                    </p>
                                </div>
                            </div>

                            {/* Supported Formats */}
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                    <FileSpreadsheet className="w-5 h-5 text-green-400" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">Excel</p>
                                        <p className="text-xs text-zinc-500">.xlsx, .xls, .csv</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                    <FileText className="w-5 h-5 text-red-400" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">PDF</p>
                                        <p className="text-xs text-zinc-500">OCR automático</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                    <FileImage className="w-5 h-5 text-blue-400" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">Imágenes</p>
                                        <p className="text-xs text-zinc-500">.png, .jpg, .webp</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">VIera AI Vision</p>
                                        <p className="text-xs text-zinc-500">Extracción IA avanzada</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {state === "idle" && selectedFile && (
                        <div className="space-y-6">
                            {/* Selected File */}
                            <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
                                {getFileIcon(selectedFile.name)}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                                    <p className="text-sm text-zinc-500">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* AI Features Info */}
                            <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-purple-500/10 border border-green-500/20">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-zinc-200">Procesamiento con VIera AI</p>
                                        <p className="text-sm text-zinc-400 mt-1">
                                            El archivo será analizado con IA de última generación para extraer
                                            y organizar automáticamente los datos en las tablas del editor.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {(state === "uploading" || state === "analyzing" || state === "creating") && (
                        <div className="py-8 flex flex-col items-center">
                            <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                            <p className="text-zinc-200 font-medium">
                                {state === "uploading" && "Subiendo archivo..."}
                                {state === "analyzing" && "VIera AI analizando..."}
                                {state === "creating" && "Creando cuaderno..."}
                            </p>
                            <p className="text-sm text-zinc-500 mt-1">
                                {state === "creating" ? "Guardando datos y hojas seleccionadas" : "Extrayendo y organizando datos"}
                            </p>
                        </div>
                    )}

                    {state === "confirm_import" && analysisResult && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <p className="text-sm font-medium text-zinc-200 mb-2">
                                    Este archivo tiene datos extraídos y puede tener hojas.
                                </p>
                                <p className="text-sm text-zinc-400">
                                    ¿Quiere guardar solo los datos en las tablas del cuaderno o también guardar las hojas del archivo?
                                </p>
                            </div>

                            {(() => {
                                const analisis = analysisResult.data?.analisis_ia || {};
                                const nParcelas = analisis.parcelas?.length ?? 0;
                                const nProductos = analisis.productos?.length ?? 0;
                                const nTratamientos = (analisis as any).tratamientos?.length ?? 0;
                                const hojas = analysisResult.hojas_resumen || [];
                                const conDatos = hojas.filter((h) => !h.vacia);
                                const vacias = hojas.filter((h) => h.vacia);
                                return (
                                    <>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-300">
                                            <span className="font-medium text-zinc-200">Datos extraídos: </span>
                                            {nParcelas} parcelas, {nProductos} productos, {nTratamientos} tratamientos.
                                            {hojas.length > 0 && (
                                                <>
                                                    {" "}
                                                    <span className="font-medium text-zinc-200">Hojas: </span>
                                                    {conDatos.length > 0 && (
                                                        <span>{conDatos.map((h) => `"${h.nombre}" (${h.num_filas} filas)`).join(", ")}</span>
                                                    )}
                                                    {vacias.length > 0 && (
                                                        <span>
                                                            {conDatos.length > 0 ? "; " : ""}
                                                            hojas vacías: {vacias.map((h) => `"${h.nombre}"`).join(", ")}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {hojas.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                                    Seleccione las hojas a guardar
                                                </p>
                                                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-white/5 border border-white/10">
                                                    {hojas.map((h) => (
                                                        <label
                                                            key={h.indice}
                                                            className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-white/5 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={hojasSeleccionadas.includes(h.indice)}
                                                                onChange={() => toggleHoja(h.indice)}
                                                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                                                            />
                                                            <span className="flex-1 text-sm text-zinc-200 truncate">
                                                                {h.nombre}
                                                            </span>
                                                            <span className="text-xs text-zinc-500 shrink-0">
                                                                {h.vacia ? "Vacía" : `${h.num_filas} filas`}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setState("idle")}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                                            >
                                                Volver
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => confirmCreate(true)}
                                                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                            >
                                                Solo guardar datos
                                            </button>
                                            {hojas.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => confirmCreate(false)}
                                                    disabled={hojasSeleccionadas.length === 0}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Guardar datos y {hojasSeleccionadas.length} hoja(s) seleccionada(s)
                                                </button>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {state === "success" && result && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-400">Datos organizados en tablas</p>
                                    <p className="text-sm text-zinc-400">Abriendo editor en tiempo real...</p>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-700">
                                <h3 className="font-medium text-zinc-200 mb-3">Datos extraídos por VIera AI</h3>
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div className="text-center p-2 rounded bg-zinc-800">
                                        <p className="text-2xl font-bold text-green-400">{result.parcelas_creadas}</p>
                                        <p className="text-zinc-500 text-xs">Parcelas</p>
                                    </div>
                                    <div className="text-center p-2 rounded bg-zinc-800">
                                        <p className="text-2xl font-bold text-blue-400">{result.productos_creados}</p>
                                        <p className="text-zinc-500 text-xs">Productos</p>
                                    </div>
                                    <div className="text-center p-2 rounded bg-zinc-800">
                                        <p className="text-2xl font-bold text-purple-400">Auto</p>
                                        <p className="text-zinc-500 text-xs">Ordenado</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {state === "error" && (
                        <div className="py-6 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                <X className="w-6 h-6 text-red-400" />
                            </div>
                            <p className="text-red-400 font-medium">Error al procesar</p>
                            <p className="text-sm text-zinc-500 mt-1 text-center">{error}</p>
                            <button
                                onClick={resetModal}
                                className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
                    {state === "idle" && (
                        <>
                            <button
                                onClick={() => { onClose(); resetModal(); }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={processFile}
                                disabled={!selectedFile}
                                className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Sparkles size={16} />
                                Procesar con IA
                            </button>
                        </>
                    )}

                    {state === "success" && (
                        <button
                            onClick={handleSuccess}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
                        >
                            Abrir Cuaderno
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
