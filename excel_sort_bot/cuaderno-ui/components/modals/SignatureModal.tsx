"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface SignatureModalProps {
    title: string;
    onConfirm: (dataUrl: string) => void;
    onClose: () => void;
    existingSignature?: string;
}

export default function SignatureModal({ title, onConfirm, onClose, existingSignature }: SignatureModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    // Si hay firma existente, pintarla al abrir
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (existingSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                setIsEmpty(false);
            };
            img.src = existingSignature;
        }
    }, [existingSignature]);

    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ("touches" in e) {
            const t = e.touches[0];
            return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
        }
        return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
    };

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        isDrawing.current = true;
        lastPos.current = getPos(e, canvas);
        setIsEmpty(false);
    }, []);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx || !lastPos.current) return;
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
    }, []);

    const endDraw = useCallback(() => {
        isDrawing.current = false;
        lastPos.current = null;
    }, []);

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const handleConfirm = () => {
        const canvas = canvasRef.current;
        if (!canvas || isEmpty) return;
        onConfirm(canvas.toDataURL("image/png"));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">✍️</span>
                        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
                </div>

                {/* Canvas */}
                <div className="p-4">
                    <p className="text-xs text-gray-500 mb-2 text-center">Firma en el recuadro de abajo</p>
                    <canvas
                        ref={canvasRef}
                        width={400}
                        height={180}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none bg-white"
                        style={{ touchAction: "none" }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleClear}
                        className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                    >
                        Borrar
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isEmpty}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Guardar firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
