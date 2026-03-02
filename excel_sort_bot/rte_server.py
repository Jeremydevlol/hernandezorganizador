"""
RTE + CUADERNO DE EXPLOTACIÓN SERVER v2.2
Servidor web unificado para:
- RTE (Workbook Real-Time Editor)
- Cuaderno de Explotación Agrícola (API Backend)

Endpoints:
- /                   - RTE Frontend
- /api/...            - RTE API
- /api/cuaderno/...   - Cuaderno API (consumido por Next.js en :3001)
"""
import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Añadir el path del proyecto
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Request, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil

from src.rte_api import (
    rte_start_session,
    rte_preview,
    rte_commit,
    rte_undo,
    rte_resolve,
    rte_validate,
    rte_export_audit,
    rte_info,
    rte_close
)

# Importar el router del cuaderno
from cuaderno.api import router as cuaderno_router

# ============================================
# APP SETUP
# ============================================

app = FastAPI(
    title="RTE + Cuaderno de Explotación",
    description="Sistema de edición de Excel con IA y Cuaderno de Explotación Agrícola",
    version="2.1"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio base
BASE_DIR = Path(__file__).parent


# ============================================
# RTE PYDANTIC MODELS
# ============================================

class StartRequest(BaseModel):
    file_path: str
    mode: str = "ADMIN"


class PreviewRequest(BaseModel):
    session_id: str
    instruction: str
    use_ai: bool = True


class CommitRequest(BaseModel):
    session_id: str
    proposal_id: str
    force: bool = False


class ResolveRequest(BaseModel):
    session_id: str
    reference: str
    field: Optional[str] = None


class UndoRequest(BaseModel):
    session_id: str
    checkpoint_id: Optional[str] = None


class CloseRequest(BaseModel):
    session_id: str


# ============================================
# RTE API ENDPOINTS
# ============================================

@app.get("/api/files")
async def list_files():
    """Lista archivos Excel disponibles para RTE"""
    files = []
    for f in BASE_DIR.glob("*.xlsx"):
        if not f.name.startswith(("~", "BACKUP_", "TEST_")):
            files.append({
                "name": f.name,
                "path": str(f),
                "size": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            })
    return {"files": sorted(files, key=lambda x: x["name"])}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Sube un archivo Excel"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel (.xlsx, .xls)")
    
    # Guardar archivo
    file_path = BASE_DIR / file.filename
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        return {
            "success": True,
            "message": f"Archivo '{file.filename}' subido correctamente",
            "path": str(file_path),
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {str(e)}")


@app.post("/api/session/start")
async def start_session(request: StartRequest):
    """Inicia sesión de edición RTE"""
    try:
        result = rte_start_session(request.file_path, request.mode)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/session/preview")
async def preview_changes(request: PreviewRequest):
    """Preview de cambios con IA"""
    try:
        result = rte_preview(
            request.session_id,
            request.instruction,
            use_ai=request.use_ai
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/session/commit")
async def commit_changes(request: CommitRequest):
    """Aplica cambios"""
    try:
        result = rte_commit(
            request.session_id,
            request.proposal_id,
            force=request.force
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/session/resolve")
async def resolve_reference(request: ResolveRequest):
    """Resuelve referencia semántica"""
    try:
        result = rte_resolve(
            request.session_id,
            request.reference,
            request.field
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/session/undo")
async def undo_changes(request: UndoRequest):
    """Rollback"""
    try:
        result = rte_undo(request.session_id, request.checkpoint_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/session/{session_id}/info")
async def session_info(session_id: str):
    """Info de sesión"""
    try:
        result = rte_info(session_id)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/session/{session_id}/audit")
async def session_audit(session_id: str):
    """Exportar auditoría"""
    try:
        result = rte_export_audit(session_id)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/session/close")
async def close_session(request: CloseRequest):
    """Cierra sesión"""
    try:
        rte_close(request.session_id)
        return {"success": True, "message": "Sesión cerrada"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# INCLUIR ROUTER DEL CUADERNO
# ============================================

app.include_router(cuaderno_router)


# ============================================
# FRONTEND ROUTES
# ============================================

@app.get("/", response_class=HTMLResponse)
async def serve_rte_frontend():
    """Sirve el frontend del RTE"""
    frontend_path = BASE_DIR / "frontend" / "index.html"
    if frontend_path.exists():
        return FileResponse(frontend_path)
    return HTMLResponse("<h1>Frontend no encontrado. Ejecuta el setup.</h1>")


# Legacy cuaderno frontend removido - Usar Next.js en http://localhost:3001


# ============================================
# STATIC FILES
# ============================================

frontend_dir = BASE_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 RTE + Cuaderno de Explotación Server v2.2")
    print("━" * 50)
    print("   📊 RTE Editor:      http://localhost:8000")
    print("   🌾 Cuaderno UI:     http://localhost:3001 (Next.js)")
    print("   📚 API Docs:        http://localhost:8000/docs")
    print("━" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)
