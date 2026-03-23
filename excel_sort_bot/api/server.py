"""
API REST para Hernandez Bueno Sort Bot
FastAPI server con:
- Función A: Organizar cuadernos (original)
- Función B: Asistente IA con Preview/Commit
"""
import os
import shutil
import tempfile
import uuid
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Añadir el directorio padre al path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from run import load_mapping, process_file
from src.ai_processor import AIProcessor, resolve_date
from src.parcel_manager import ParcelManager
from src.template_fingerprint import fingerprint_workbook, load_registry, match_template
from cuaderno.api import router as cuaderno_router

# ========================================
# Configuración
# ========================================

app = FastAPI(
    title="Hernandez Bueno Sort Bot API",
    description="API para organizar archivos Excel y gestionar tratamientos con IA",
    version="2.0.0"
)

# Incluir router de cuaderno (API REST de cuaderno de explotación)
app.include_router(cuaderno_router)

# CORS
allow_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins_list = [origin.strip() for origin in allow_origins_env.split(",") if origin.strip()]
default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://hernandezbuenoorganizador.vercel.app",
    "https://hernandezorganizador.vercel.app",
]

# Sin "*" mezclado con credenciales: lista explícita + env; duplicados se eliminan.
_merged_origins = list(dict.fromkeys(origins_list + default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_merged_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Fields-Extracted", "X-Warnings", "X-Errors", "X-Parcels-Count"],
)

# Directorios
BASE_DIR = Path(__file__).parent.parent
TEMP_DIR = Path(tempfile.gettempdir()) / "excel_sort_bot"
TEMP_DIR.mkdir(exist_ok=True)

DEFAULT_TEMPLATE = BASE_DIR / "template.xlsx"
MAPPING_PATH = BASE_DIR / "config" / "mapping.json"

# Almacén de propuestas en memoria (para MVP)
# En producción: Redis o DB
proposals_store: Dict[str, Dict[str, Any]] = {}

# Registro de commits ejecutados (para idempotencia)
# Clave: proposal_id, Valor: timestamp de commit
committed_proposals: Dict[str, datetime] = {}

PROPOSAL_TTL_MINUTES = 30
COMMITTED_LOG_TTL_MINUTES = 60  # Mantener registro de commits por 1 hora

# Procesador IA
ai_processor = AIProcessor()

# Límite de parcelas sin confirmación extra
MAX_PARCELS_WITHOUT_CONFIRM = 20


# ========================================
# Utilidades
# ========================================

def cleanup_old_files():
    """Limpia archivos temporales de más de 1 hora"""
    now = datetime.now().timestamp()
    for file in TEMP_DIR.glob("*"):
        if now - file.stat().st_mtime > 3600:
            try:
                file.unlink()
            except:
                pass


def cleanup_old_proposals():
    """Limpia propuestas expiradas"""
    now = datetime.now()
    expired = []
    for pid, data in proposals_store.items():
        if now - data.get("created_at", now) > timedelta(minutes=PROPOSAL_TTL_MINUTES):
            expired.append(pid)
    for pid in expired:
        # Limpiar archivo temporal asociado
        try:
            if proposals_store[pid].get("file_path"):
                Path(proposals_store[pid]["file_path"]).unlink(missing_ok=True)
        except:
            pass
        del proposals_store[pid]
    
    # Limpiar registro de commits antiguos
    expired_commits = []
    for pid, commit_time in committed_proposals.items():
        if now - commit_time > timedelta(minutes=COMMITTED_LOG_TTL_MINUTES):
            expired_commits.append(pid)
    for pid in expired_commits:
        del committed_proposals[pid]


def save_temp_file(upload: UploadFile, prefix: str = "input") -> Path:
    """Guarda un archivo subido y devuelve la ruta"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c for c in upload.filename if c.isalnum() or c in "._- ")
    file_path = TEMP_DIR / f"{prefix}_{timestamp}_{safe_name}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)
    return file_path


# ========================================
# Endpoints de Salud
# ========================================

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Hernandez Bueno Sort Bot API",
        "version": "2.0.0",
        "features": ["organize", "ai_preview", "ai_commit"]
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# ========================================
# FUNCIÓN A: Organizador de Cuadernos
# ========================================

@app.post("/api/process")
async def process_excel(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """Procesa un archivo Excel base y devuelve info para descarga"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel (.xlsx, .xls)")
    
    if not DEFAULT_TEMPLATE.exists():
        raise HTTPException(status_code=500, detail=f"Plantilla no encontrada: {DEFAULT_TEMPLATE}")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
    file_id = f"{timestamp}_{safe_name.replace('.xlsx', '').replace('.xls', '')}"
    
    input_path = TEMP_DIR / f"input_{file_id}.xlsx"
    output_name = f"{safe_name.replace('.xlsx', '').replace('.xls', '')}_ORDENADO.xlsx"
    output_path = TEMP_DIR / f"output_{file_id}.xlsx"
    
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        mapping = load_mapping(str(MAPPING_PATH))
        
        result = process_file(
            str(input_path),
            str(DEFAULT_TEMPLATE),
            str(output_path),
            mapping,
            strict=False,
            debug=False
        )
        
        if not output_path.exists():
            raise HTTPException(status_code=500, detail=f"Error procesando archivo: {result.warnings}")
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_files)
        
        return JSONResponse({
            "success": True,
            "download_id": file_id,
            "filename": output_name,
            "fields_extracted": len(result.extracted_values),
            "warnings": len(result.warnings),
            "errors": len(result.errors)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        if input_path.exists():
            input_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Descarga un archivo procesado por su ID"""
    output_path = TEMP_DIR / f"output_{file_id}.xlsx"
    
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado o expirado")
    
    parts = file_id.split('_', 2)
    original_name = parts[2] if len(parts) >= 3 else "archivo"
    download_name = f"{original_name}_ORDENADO.xlsx"
    
    return FileResponse(
        path=str(output_path),
        filename=download_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ========================================
# FUNCIÓN B: Asistente IA - Preview/Commit
# ========================================

@app.post("/api/chat-action/preview")
async def preview_treatment(
    file: UploadFile = File(...),
    message: str = Form(...),
    background_tasks: BackgroundTasks = None
):
    """
    Preview de un tratamiento: interpreta el comando, selecciona parcelas,
    valida y devuelve propuesta SIN modificar el Excel.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")
    
    # Guardar archivo temporal
    input_path = save_temp_file(file, prefix="preview")
    
    try:
        # 0. TEMPLATE FINGERPRINT GATE
        fp = fingerprint_workbook(str(input_path), parcels_sheet_hint_contains=["2.1.", "PARCELAS"])
        registry = load_registry()
        template_decision = match_template(fp, registry)
        
        if template_decision["status"] == "REJECT":
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error": "UNSUPPORTED_TEMPLATE",
                    "message": "Plantilla de cuaderno no soportada. Sube un cuaderno compatible o contacta soporte.",
                    "template_decision": template_decision,
                    "fingerprint": {
                        "parcels_sheet": fp.parcels_sheet,
                        "header_row": fp.header_row,
                        "columns_map": fp.columns_map,
                        "sheetnames": fp.sheetnames
                    }
                }
            )
        
        template_warning = template_decision["status"] == "WARN"
        
        # 1. Leer parcelas
        pm = ParcelManager(str(input_path))
        parcels = pm.get_parcels()
        
        if not parcels:
            raise HTTPException(
                status_code=400, 
                detail="No se encontraron parcelas en el archivo. Asegúrate de que tenga una hoja con datos de parcelas."
            )
        
        # Obtener contexto estructurado para IA
        context = pm.get_context_for_ai()
        
        # 2. Interpretar con IA
        intent = ai_processor.interpret_command(message, context)
        
        if "error" in intent:
            raise HTTPException(status_code=500, detail=intent["error"])
        
        # 3. Validar acción permitida
        action = intent.get("action")
        if action != "ADD_TREATMENT":
            raise HTTPException(
                status_code=400, 
                detail=f"Acción '{action}' no soportada. Solo se permite ADD_TREATMENT."
            )
        
        # 4. Resolver fecha
        date_obj = intent.get("data", {}).get("date", {})
        resolved_date = resolve_date(date_obj)
        
        # 5. Filtrar parcelas
        filters = intent.get("filters", {})
        targets = filters.get("targets", {})
        scope = targets.get("scope", "ALL")
        
        matched_parcels = pm.filter_parcels(scope, targets)
        
        # 6. Validaciones
        warnings = []
        errors = []
        
        if not matched_parcels:
            errors.append("No se encontraron parcelas que coincidan con el filtro.")
        
        treatment_data = intent.get("data", {})
        
        if not treatment_data.get("product"):
            errors.append("Falta el producto del tratamiento.")
        
        dose = treatment_data.get("dose", {})
        if not dose.get("value") or dose.get("value") <= 0:
            errors.append("La dosis debe ser mayor que 0.")
        
        if not treatment_data.get("registry_number"):
            warnings.append("Producto sin número de registro oficial.")
        
        if not treatment_data.get("pest"):
            warnings.append("No se especificó plaga/enfermedad objetivo.")
        
        # Detectar si el usuario mencionó "recinto" (no soportado aún en exclusiones)
        message_lower = message.lower()
        if "recinto" in message_lower and ("excepto" in message_lower or "excluir" in message_lower or "sin" in message_lower):
            warnings.append("⚠️ ATENCIÓN: El filtro por recinto específico no está soportado aún. Se aplicará a TODOS los recintos de la parcela. Confirma si esto es correcto.")
        
        # Detectar custom_query (requiere revisión manual)
        if targets.get("custom_query"):
            warnings.append(f"⚠️ Consulta personalizada detectada: '{targets['custom_query']}'. Requiere confirmación manual.")
        
        # Detectar múltiples recintos y advertir
        if matched_parcels:
            # Agrupar por polígono/parcela
            from collections import defaultdict
            groups = defaultdict(list)
            for p in matched_parcels:
                groups[(p.polygon, p.parcel)].append(p.recinto)
            
            multi_recinto = [(k, v) for k, v in groups.items() if len(v) > 1]
            if multi_recinto:
                for (pol, parc), recintos in multi_recinto:
                    recintos_str = ", ".join(str(r) for r in set(recintos))
                    warnings.append(f"La parcela Pol {pol} Parc {parc} tiene {len(recintos)} recintos ({recintos_str}). Se aplicará a TODOS.")
        
        requires_confirmation = len(matched_parcels) > MAX_PARCELS_WITHOUT_CONFIRM

        
        # 7. Generar preview de filas (sin escribir)
        rows_preview = []
        if matched_parcels and not errors:
            rows_preview = pm.generate_treatment_rows(
                matched_parcels,
                treatment_data,
                resolved_date,
                start_order=1
            )
        
        # 8. Crear propuesta
        proposal_id = str(uuid.uuid4())
        proposals_store[proposal_id] = {
            "created_at": datetime.now(),
            "file_path": str(input_path),
            "intent": intent,
            "resolved_date": resolved_date,
            "matched_parcels": [p.to_dict() for p in matched_parcels],
            "rows": rows_preview,
            "treatment_data": treatment_data
        }
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_proposals)
        
        return JSONResponse({
            "success": len(errors) == 0,
            "proposal_id": proposal_id,
            "intent": intent,
            "template_decision": {
                "template_id": template_decision["template_id"],
                "score": template_decision["score"],
                "status": template_decision["status"]
            },
            "resolved": {
                "date_ddmmyyyy": resolved_date,
                "parcels_matched": len(matched_parcels),
                "parcels_list": [
                    {"polygon": p.polygon, "parcel": p.parcel, "crop": p.crop, "surface": p.surface_ha}
                    for p in matched_parcels[:10]  # Solo primeras 10 para preview
                ],
                "total_surface_ha": round(sum(p.surface_ha for p in matched_parcels), 2),
                "requires_confirmation": requires_confirmation or template_warning
            },
            "warnings": warnings,
            "errors": errors,
            "rows_preview": rows_preview[:3]  # Solo 3 filas de ejemplo
        })
        
    except HTTPException:
        raise
    except Exception as e:
        if input_path.exists():
            input_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/api/chat-action/commit")
async def commit_treatment(
    proposal_id: str = Form(...),
    background_tasks: BackgroundTasks = None
):
    """
    Ejecuta una propuesta previamente generada: escribe los tratamientos en el Excel.
    """
    # IDEMPOTENCIA: Verificar si ya se ejecutó este commit
    if proposal_id in committed_proposals:
        commit_time = committed_proposals[proposal_id]
        return JSONResponse(
            status_code=409,  # Conflict
            content={
                "success": False,
                "error": "ALREADY_COMMITTED",
                "message": f"Esta propuesta ya fue ejecutada el {commit_time.strftime('%d/%m/%Y %H:%M:%S')}. Genera una nueva si deseas repetir el tratamiento.",
                "proposal_id": proposal_id,
                "committed_at": commit_time.isoformat()
            }
        )
    
    # Buscar propuesta
    proposal = proposals_store.get(proposal_id)
    
    if not proposal:
        # Verificar si existe en el log de committed (propuesta expirada pero ejecutada)
        raise HTTPException(
            status_code=404, 
            detail="Propuesta no encontrada o expirada. Genera una nueva con /preview."
        )
    
    file_path = Path(proposal["file_path"])
    if not file_path.exists():
        del proposals_store[proposal_id]
        raise HTTPException(status_code=404, detail="Archivo temporal expirado. Sube el archivo de nuevo.")
    
    try:
        # Cargar ParcelManager con el archivo guardado
        pm = ParcelManager(str(file_path))
        
        # Escribir tratamientos
        rows = proposal["rows"]
        if not rows:
            raise HTTPException(status_code=400, detail="No hay filas para escribir.")
        
        output_path, rows_written = pm.write_treatments(rows)
        
        # Registrar commit para idempotencia (antes de eliminar la propuesta)
        committed_proposals[proposal_id] = datetime.now()
        
        # Limpiar propuesta usada (ya no se puede re-ejecutar)
        del proposals_store[proposal_id]
        
        if background_tasks:
            background_tasks.add_task(cleanup_old_files)
            background_tasks.add_task(cleanup_old_proposals)
        
        # Devolver archivo
        return FileResponse(
            path=output_path,
            filename=f"TRATAMIENTOS_{Path(output_path).name}",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "X-Parcels-Count": str(rows_written),
                "X-Action": "ADD_TREATMENT"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al escribir: {str(e)}")


@app.delete("/api/chat-action/cancel/{proposal_id}")
async def cancel_proposal(proposal_id: str):
    """Cancela una propuesta pendiente"""
    if proposal_id in proposals_store:
        try:
            Path(proposals_store[proposal_id]["file_path"]).unlink(missing_ok=True)
        except:
            pass
        del proposals_store[proposal_id]
        return {"success": True, "message": "Propuesta cancelada"}
    return {"success": False, "message": "Propuesta no encontrada"}


# ========================================
# Endpoint de información
# ========================================

@app.get("/api/info")
async def get_info():
    """Devuelve información sobre la configuración actual"""
    try:
        mapping = load_mapping(str(MAPPING_PATH))
        return {
            "template_exists": DEFAULT_TEMPLATE.exists(),
            "template_name": DEFAULT_TEMPLATE.name if DEFAULT_TEMPLATE.exists() else None,
            "mapping_version": mapping.meta.version,
            "fields_count": len(mapping.fields),
            "active_proposals": len(proposals_store),
            "features": {
                "organize": True,
                "ai_preview": True,
                "ai_commit": True,
                "max_parcels_auto": MAX_PARCELS_WITHOUT_CONFIRM
            }
        }
    except Exception as e:
        return {"error": str(e)}


# ========================================
# Main
# ========================================

if __name__ == "__main__":
    print("🚀 Iniciando Hernandez Bueno Sort Bot API v2.0...")
    print(f"📁 Plantilla: {DEFAULT_TEMPLATE}")
    print(f"📋 Mapping: {MAPPING_PATH}")
    print(f"🌐 Server: http://localhost:8000")
    print(f"📖 Docs: http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
