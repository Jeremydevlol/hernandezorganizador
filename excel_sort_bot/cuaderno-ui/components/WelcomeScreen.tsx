"use client";

import { Plus, FileText, Keyboard, Wheat } from "lucide-react";
import { Cuaderno } from "@/lib/types";
import { useState } from "react";
import CreateCuadernoModal from "./modals/CreateCuadernoModal";

interface WelcomeScreenProps {
    onCreateCuaderno: (data: Partial<Cuaderno>) => void;
}

export default function WelcomeScreen({ onCreateCuaderno }: WelcomeScreenProps) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className="flex-1 flex items-center justify-center bg-[var(--bg-darker)]">
                <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Wheat className="w-8 h-8 text-emerald-400" />
                    </div>

                    <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight mb-2">
                        Cuaderno de Explotación Agrícola
                    </h1>
                    <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                        Sistema digital de gestión de tratamientos con editor tipo Excel y asistente IA
                    </p>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors hover:shadow-lg hover:shadow-emerald-500/15"
                    >
                        <Plus size={18} />
                        Crear Cuaderno
                    </button>

                    <div className="mt-10 flex items-center justify-center gap-6 text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                            <Keyboard size={14} className="text-zinc-600" />
                            <span>
                                <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono">
                                    Ctrl
                                </kbd>
                                {" + "}
                                <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono">
                                    N
                                </kbd>
                                {" "}Nuevo
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono">
                                Ctrl
                            </kbd>
                            {" + "}
                            <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono">
                                S
                            </kbd>
                            {" "}Guardar
                        </div>
                    </div>

                    <div className="mt-12 grid grid-cols-3 gap-3 text-left">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <FileText size={18} className="text-emerald-400 mb-2" />
                            <h3 className="text-sm font-medium text-zinc-200">Gestión completa</h3>
                            <p className="text-xs text-zinc-500 mt-1">Parcelas, productos y tratamientos</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <FileText size={18} className="text-emerald-400 mb-2" />
                            <h3 className="text-sm font-medium text-zinc-200">Exportación PDF</h3>
                            <p className="text-xs text-zinc-500 mt-1">Documentos oficiales seguros</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <FileText size={18} className="text-emerald-400 mb-2" />
                            <h3 className="text-sm font-medium text-zinc-200">Histórico</h3>
                            <p className="text-xs text-zinc-500 mt-1">Trazabilidad completa</p>
                        </div>
                    </div>
                </div>
            </div>

            <CreateCuadernoModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onCreate={onCreateCuaderno}
            />
        </>
    );
}
