"""
RTE API ENDPOINTS v2.0 — Edición en Tiempo Real ENTERPRISE
FastAPI endpoints para el Workbook Real-Time Editor.

v2.0 Features:
- Semantic Resolver integrado
- Contract Validator con guardrails
- File Locking por sesión
- Tamper-proof proposals (ops_hash, TTL)
- Auditoría exportable

Endpoints:
- POST /rte/session/start - Inicia sesión de edición
- POST /rte/session/{id}/preview - Preview de cambios
- POST /rte/session/{id}/commit - Aplica cambios
- POST /rte/session/{id}/undo - Rollback
- GET /rte/session/{id}/info - Info de sesión
- POST /rte/session/{id}/resolve - Resuelve referencia semántica
- GET /rte/audit/{session_id}/export - Exporta auditoría
"""
import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

# Las siguientes importaciones se usarían con FastAPI
# from fastapi import APIRouter, HTTPException, UploadFile, File
# router = APIRouter(prefix="/rte", tags=["RTE"])

from src.workbook_rte import WorkbookRTE, Op, OpType, ValueType, PermissionMode, WorkbookContract
from src.rte_ai_processor import RTEAIProcessor
from src.rte_semantic_resolver import SemanticResolver
from src.rte_contract_validator import (
    ContractValidator, ValueValidator, DataType,
    SecureProposal, file_lock_manager
)


# ============================================
# PYDANTIC MODELS
# ============================================

class StartSessionRequest(BaseModel):
    file_path: str
    mode: str = "STRICT"  # STRICT, POWER, ADMIN
    golden_template_id: Optional[str] = None


class StartSessionResponse(BaseModel):
    session_id: str
    file_path: str
    mode: str
    sheets: List[str]
    checksum: str
    capabilities: List[str]
    locked: bool = True


class PreviewRequest(BaseModel):
    instruction: str
    selection: Optional[Dict] = None  # {sheet, cell, range}
    use_ai: bool = True


class PreviewResponse(BaseModel):
    proposal_id: str
    ops: List[Dict]
    diff_preview: Dict
    requires_confirmation: bool
    warnings: List[str]
    questions: List[str]
    expires_at: Optional[str] = None
    ops_hash: Optional[str] = None


class CommitRequest(BaseModel):
    proposal_id: str
    idempotency_key: Optional[str] = None
    force: bool = False  # Si True, ignora requires_confirmation


class CommitResponse(BaseModel):
    success: bool
    audit_id: Optional[str] = None
    cells_changed: int = 0
    rows_changed: int = 0
    checksum: Optional[str] = None
    error: Optional[str] = None


class UndoRequest(BaseModel):
    checkpoint_id: Optional[str] = None


class UndoResponse(BaseModel):
    success: bool
    restored_from: Optional[str] = None
    checksum: Optional[str] = None
    error: Optional[str] = None


class ResolveRequest(BaseModel):
    reference: str
    field: Optional[str] = None  # "fecha", "dosis", etc.
    sheet: Optional[str] = "inf.trat 1"


class ResolveResponse(BaseModel):
    success: bool
    sheet: str
    cells: List[str]
    rows: List[int]
    description: str
    confidence: float = 1.0
    error: Optional[str] = None


class ValidateRequest(BaseModel):
    sheet: str
    cell: str
    value: Any


class ValidateResponse(BaseModel):
    valid: bool
    normalized_value: Optional[Any] = None
    errors: List[str] = []
    warnings: List[str] = []


# ============================================
# ENHANCED RTE SESSION
# ============================================

class EnhancedRTESession:
    """Sesión RTE con todos los blindajes enterprise"""
    
    def __init__(self, rte: WorkbookRTE, file_path: str):
        self.rte = rte
        self.file_path = file_path
        self.resolver = SemanticResolver(workbook=rte.wb)
        self.validator = ContractValidator()
        self.secure_proposals: Dict[str, SecureProposal] = {}
        self.audit_entries: List[Dict] = []
        
        # Configurar validator con hojas del workbook
        if rte.wb:
            self.validator.set_sheet_names(rte.wb.sheetnames)
    
    def close(self):
        """Cierra la sesión y libera recursos"""
        self.resolver.close()
        self.rte.close()
        file_lock_manager.release(self.file_path, self.rte.session_id)


# ============================================
# RTE SESSION MANAGER v2.0
# ============================================

class RTESessionManager:
    """Gestiona sesiones de edición RTE con blindajes enterprise"""
    
    VERSION = "2.0"
    PROPOSAL_TTL_MINUTES = 10
    
    def __init__(self):
        self.sessions: Dict[str, EnhancedRTESession] = {}
        self.ai_processor = RTEAIProcessor()
    
    def start_session(self, request: StartSessionRequest) -> StartSessionResponse:
        """Inicia una sesión de edición con lock de archivo"""
        file_path = Path(request.file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
        
        # Determinar modo
        mode = PermissionMode.STRICT
        if request.mode == "POWER":
            mode = PermissionMode.POWER
        elif request.mode == "ADMIN":
            mode = PermissionMode.ADMIN
        
        # Crear RTE
        rte = WorkbookRTE(str(file_path), mode=mode)
        rte.open()
        
        # Intentar adquirir lock
        success, error = file_lock_manager.acquire(str(file_path), rte.session_id)
        if not success:
            rte.close()
            raise PermissionError(f"Archivo bloqueado: {error}")
        
        # Crear sesión mejorada
        session = EnhancedRTESession(rte, str(file_path))
        self.sessions[rte.session_id] = session
        
        # Capabilities según modo
        capabilities = rte.get_capabilities()
        
        return StartSessionResponse(
            session_id=rte.session_id,
            file_path=str(file_path),
            mode=mode.value,
            sheets=rte.wb.sheetnames,
            checksum=rte._file_checksum(),
            capabilities=capabilities,
            locked=True
        )
    
    def preview(self, session_id: str, request: PreviewRequest) -> PreviewResponse:
        """Preview de cambios con validación de contrato"""
        session = self._get_session(session_id)
        rte = session.rte
        
        warnings = []
        
        # 1. Si hay referencia semántica en la instrucción, resolverla
        # (Esto se hará en el AI processor que usará el resolver)
        
        # 2. Generar ops con IA
        ai_result = self.ai_processor.generate_ops(
            instruction=request.instruction,
            selection=request.selection,
            use_ai=request.use_ai
        )
        
        warnings.extend(ai_result.get("warnings", []))
        
        # 3. Validar cada op contra el contrato
        validated_ops = []
        for op in ai_result["ops"]:
            if op.op == OpType.SET_CELL and op.cell:
                validation = session.validator.validate_cell_edit(
                    op.sheet, op.cell, op.value
                )
                if not validation.valid:
                    warnings.extend(validation.errors)
                    continue
                
                # Usar valor normalizado
                if validation.normalized_value is not None:
                    op.value = validation.normalized_value
            
            validated_ops.append(op)
        
        # 4. Preview en RTE
        proposal = rte.preview(
            instruction=request.instruction,
            ops=validated_ops,
            selection=request.selection
        )
        
        # 5. Crear propuesta segura (tamper-proof)
        ops_dicts = [op.to_dict() for op in proposal.ops]
        secure = SecureProposal.create(
            proposal_id=proposal.proposal_id,
            ops=ops_dicts,
            checksum_before=rte._file_checksum(),
            session_id=session_id,
            ttl_minutes=self.PROPOSAL_TTL_MINUTES
        )
        session.secure_proposals[proposal.proposal_id] = secure
        
        # Combinar warnings
        all_warnings = warnings + proposal.warnings
        
        return PreviewResponse(
            proposal_id=proposal.proposal_id,
            ops=ops_dicts,
            diff_preview=proposal.diff_preview,
            requires_confirmation=proposal.requires_confirmation or ai_result.get("requires_confirmation", False),
            warnings=all_warnings,
            questions=ai_result.get("questions", []),
            expires_at=secure.expires_at.isoformat(),
            ops_hash=secure.ops_hash
        )
    
    def commit(self, session_id: str, request: CommitRequest) -> CommitResponse:
        """Aplica cambios con validación tamper-proof"""
        session = self._get_session(session_id)
        rte = session.rte
        
        # 1. Verificar propuesta segura
        secure = session.secure_proposals.get(request.proposal_id)
        if secure:
            # Verificar TTL
            if secure.is_expired():
                return CommitResponse(
                    success=False,
                    error="PROPOSAL_EXPIRED",
                    cells_changed=0
                )
            
            # Verificar checksum (archivo no modificado)
            current_checksum = rte._file_checksum()
            if current_checksum != secure.checksum_before:
                return CommitResponse(
                    success=False,
                    error="FILE_MODIFIED_SINCE_PREVIEW",
                    cells_changed=0
                )
        
        # 2. Si force=True, marcar propuesta como confirmada
        if request.force and request.proposal_id in rte.proposals:
            rte.proposals[request.proposal_id].requires_confirmation = False
        
        # 3. Ejecutar commit
        result = rte.commit(
            proposal_id=request.proposal_id,
            idempotency_key=request.idempotency_key
        )
        
        # 4. Registrar en auditoría
        if result.get("success"):
            audit_entry = {
                "audit_id": result.get("audit_id"),
                "proposal_id": request.proposal_id,
                "timestamp": datetime.now().isoformat(),
                "cells_changed": result.get("cells_changed", 0),
                "rows_changed": result.get("rows_changed", 0),
                "checksum_before": secure.checksum_before if secure else None,
                "checksum_after": result.get("checksum"),
                "ops_hash": secure.ops_hash if secure else None,
            }
            session.audit_entries.append(audit_entry)
            
            return CommitResponse(
                success=True,
                audit_id=result.get("audit_id"),
                cells_changed=result.get("cells_changed", 0),
                rows_changed=result.get("rows_changed", 0),
                checksum=result.get("checksum")
            )
        else:
            return CommitResponse(
                success=False,
                error=result.get("error"),
                cells_changed=0
            )
    
    def undo(self, session_id: str, request: UndoRequest) -> UndoResponse:
        """Rollback"""
        session = self._get_session(session_id)
        rte = session.rte
        
        result = rte.undo(checkpoint_id=request.checkpoint_id)
        
        if result.get("success"):
            return UndoResponse(
                success=True,
                restored_from=result.get("restored_from"),
                checksum=result.get("checksum")
            )
        else:
            return UndoResponse(
                success=False,
                error=result.get("error")
            )
    
    def resolve(self, session_id: str, request: ResolveRequest) -> ResolveResponse:
        """Resuelve una referencia semántica"""
        session = self._get_session(session_id)
        
        target = session.resolver.resolve(request.reference, request.sheet or "inf.trat 1")
        
        # Si se especificó un campo, resolver columna también
        cells = target.cells
        if request.field and target.rows:
            col = session.resolver.resolve_column(request.field, target.sheet)
            if col:
                cells = [f"{col}{row}" for row in target.rows]
        
        return ResolveResponse(
            success=len(target.rows) > 0,
            sheet=target.sheet,
            cells=cells,
            rows=target.rows,
            description=target.description,
            confidence=target.confidence,
            error=None if target.rows else target.description
        )
    
    def validate(self, session_id: str, request: ValidateRequest) -> ValidateResponse:
        """Valida un valor antes de editar"""
        session = self._get_session(session_id)
        
        result = session.validator.validate_cell_edit(
            request.sheet, request.cell, request.value
        )
        
        return ValidateResponse(
            valid=result.valid,
            normalized_value=result.normalized_value,
            errors=result.errors,
            warnings=result.warnings
        )
    
    def export_audit(self, session_id: str) -> Dict:
        """Exporta auditoría de la sesión"""
        session = self._get_session(session_id)
        
        return {
            "session_id": session_id,
            "version": self.VERSION,
            "file_path": session.file_path,
            "mode": session.rte.mode.value,
            "exported_at": datetime.now().isoformat(),
            "entries": session.audit_entries,
            "total_commits": len(session.audit_entries),
            "current_checksum": session.rte._file_checksum()
        }
    
    def get_info(self, session_id: str) -> Dict:
        """Info de sesión"""
        session = self._get_session(session_id)
        info = session.rte.get_session_info()
        
        # Añadir info enterprise
        info["locked"] = file_lock_manager.get_lock_owner(session.file_path) == session_id
        info["pending_proposals"] = len(session.secure_proposals)
        info["audit_entries"] = len(session.audit_entries)
        
        return info
    
    def close_session(self, session_id: str):
        """Cierra sesión"""
        session = self._get_session(session_id)
        session.close()
        del self.sessions[session_id]
    
    def _get_session(self, session_id: str) -> EnhancedRTESession:
        """Obtiene sesión o lanza error"""
        if session_id not in self.sessions:
            raise KeyError(f"Sesión no encontrada: {session_id}")
        return self.sessions[session_id]


# ============================================
# SINGLETON GLOBAL
# ============================================

_rte_manager: Optional[RTESessionManager] = None


def get_rte_manager() -> RTESessionManager:
    """Obtiene el manager global"""
    global _rte_manager
    if _rte_manager is None:
        _rte_manager = RTESessionManager()
    return _rte_manager


# ============================================
# API FUNCTIONS (para usar sin FastAPI)
# ============================================

def rte_start_session(file_path: str, mode: str = "STRICT") -> Dict:
    """Inicia sesión RTE con lock de archivo"""
    manager = get_rte_manager()
    request = StartSessionRequest(file_path=file_path, mode=mode)
    response = manager.start_session(request)
    return response.model_dump()


def rte_preview(session_id: str, instruction: str, 
                selection: Dict = None, use_ai: bool = True) -> Dict:
    """Preview de cambios con validación"""
    manager = get_rte_manager()
    request = PreviewRequest(instruction=instruction, selection=selection, use_ai=use_ai)
    response = manager.preview(session_id, request)
    return response.model_dump()


def rte_commit(session_id: str, proposal_id: str, 
               idempotency_key: str = None, force: bool = False) -> Dict:
    """Aplica cambios con tamper-proof verification"""
    manager = get_rte_manager()
    request = CommitRequest(proposal_id=proposal_id, idempotency_key=idempotency_key, force=force)
    response = manager.commit(session_id, request)
    return response.model_dump()


def rte_undo(session_id: str, checkpoint_id: str = None) -> Dict:
    """Rollback"""
    manager = get_rte_manager()
    request = UndoRequest(checkpoint_id=checkpoint_id)
    response = manager.undo(session_id, request)
    return response.model_dump()


def rte_resolve(session_id: str, reference: str, 
                field: str = None, sheet: str = "inf.trat 1") -> Dict:
    """Resuelve referencia semántica"""
    manager = get_rte_manager()
    request = ResolveRequest(reference=reference, field=field, sheet=sheet)
    response = manager.resolve(session_id, request)
    return response.model_dump()


def rte_validate(session_id: str, sheet: str, cell: str, value: Any) -> Dict:
    """Valida un valor"""
    manager = get_rte_manager()
    request = ValidateRequest(sheet=sheet, cell=cell, value=value)
    response = manager.validate(session_id, request)
    return response.model_dump()


def rte_export_audit(session_id: str) -> Dict:
    """Exporta auditoría"""
    manager = get_rte_manager()
    return manager.export_audit(session_id)


def rte_info(session_id: str) -> Dict:
    """Info de sesión"""
    manager = get_rte_manager()
    return manager.get_info(session_id)


def rte_close(session_id: str):
    """Cierra sesión"""
    manager = get_rte_manager()
    manager.close_session(session_id)
