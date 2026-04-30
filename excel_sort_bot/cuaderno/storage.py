"""
CUADERNO DE EXPLOTACIÓN - GESTOR DE ALMACENAMIENTO
Soporta dos modos:
  - "local"    → archivos JSON en disco (desarrollo)
  - "supabase" → base de datos Supabase (producción)
"""
import os
import json
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime
import shutil

from .models import CuadernoExplotacion


# ============================================
# STORAGE LOCAL (archivos JSON) - SIN CAMBIOS
# ============================================

class LocalStorage:
    """Almacena cuadernos como archivos JSON en disco."""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = Path(__file__).parent.parent / "cuadernos_data"
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir = self.base_dir / "backups"
        self.backup_dir.mkdir(exist_ok=True)

    def _get_filepath(self, cuaderno_id: str) -> Path:
        return self.base_dir / f"cuaderno_{cuaderno_id}.json"

    def crear(self, cuaderno: CuadernoExplotacion) -> CuadernoExplotacion:
        filepath = self._get_filepath(cuaderno.id)
        if filepath.exists():
            raise ValueError(f"Ya existe un cuaderno con ID: {cuaderno.id}")
        cuaderno.guardar(str(filepath))
        return cuaderno

    def guardar(self, cuaderno: CuadernoExplotacion) -> CuadernoExplotacion:
        filepath = self._get_filepath(cuaderno.id)
        if filepath.exists():
            self._crear_backup(cuaderno.id)
        cuaderno.guardar(str(filepath))
        return cuaderno

    def cargar(self, cuaderno_id: str) -> Optional[CuadernoExplotacion]:
        filepath = self._get_filepath(cuaderno_id)
        if not filepath.exists():
            return None
        cuaderno = CuadernoExplotacion.cargar(str(filepath))
        # Auto-reparación de tratamientos que mezclan parcelas de cultivos distintos.
        # + Auto-reparación de históricos mal particionados por Nº orden multi-parcela.
        # Es idempotente: si no hay nada que reparar, no reescribe el fichero.
        try:
            reparados_multi_cultivo = cuaderno.reparar_tratamientos_multi_cultivo()
            reparados_num_orden = cuaderno.reparar_tratamientos_num_orden_multi_parcela()
            restablecidos_individual = cuaderno.reestablecer_num_orden_individual_tratamientos()
            total_reparados = reparados_multi_cultivo + reparados_num_orden + restablecidos_individual
            if total_reparados > 0:
                cuaderno.guardar(str(filepath))
                print(
                    f"[auto-repair] Cuaderno {cuaderno_id}: "
                    f"{reparados_multi_cultivo} multi-cultivo + "
                    f"{reparados_num_orden} por Nº orden + "
                    f"{restablecidos_individual} restablecidos individuales."
                )
        except Exception as e:
            print(f"[auto-repair] Error reparando cuaderno {cuaderno_id}: {e}")
        return cuaderno

    def listar(self) -> List[Dict]:
        cuadernos = []
        for filepath in self.base_dir.glob("cuaderno_*.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                cuadernos.append({
                    "id": data.get("id"),
                    "nombre_explotacion": data.get("nombre_explotacion", "Sin nombre"),
                    "titular": data.get("titular", ""),
                    "año": data.get("año"),
                    "num_parcelas": len(data.get("parcelas", [])),
                    "num_tratamientos": len(data.get("tratamientos", [])),
                    "fecha_modificacion": data.get("fecha_modificacion"),
                    "filepath": str(filepath)
                })
            except Exception as e:
                print(f"Error leyendo {filepath}: {e}")
                continue
        cuadernos.sort(key=lambda x: x.get("fecha_modificacion", ""), reverse=True)
        return cuadernos

    def eliminar(self, cuaderno_id: str) -> bool:
        filepath = self._get_filepath(cuaderno_id)
        if not filepath.exists():
            return False
        self._crear_backup(cuaderno_id)
        filepath.unlink()
        return True

    def _crear_backup(self, cuaderno_id: str):
        filepath = self._get_filepath(cuaderno_id)
        if not filepath.exists():
            return
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"cuaderno_{cuaderno_id}_{timestamp}.json"
        backup_path = self.backup_dir / backup_name
        shutil.copy2(filepath, backup_path)
        self._limpiar_backups_antiguos(cuaderno_id)

    def _limpiar_backups_antiguos(self, cuaderno_id: str, max_backups: int = 10):
        pattern = f"cuaderno_{cuaderno_id}_*.json"
        backups = list(self.backup_dir.glob(pattern))
        backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        for backup in backups[max_backups:]:
            backup.unlink()

    def restaurar_backup(self, cuaderno_id: str, timestamp: str = None) -> Optional[CuadernoExplotacion]:
        if timestamp:
            backup_path = self.backup_dir / f"cuaderno_{cuaderno_id}_{timestamp}.json"
        else:
            pattern = f"cuaderno_{cuaderno_id}_*.json"
            backups = list(self.backup_dir.glob(pattern))
            if not backups:
                return None
            backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            backup_path = backups[0]
        if not backup_path.exists():
            return None
        return CuadernoExplotacion.cargar(str(backup_path))

    def listar_backups(self, cuaderno_id: str) -> List[Dict]:
        pattern = f"cuaderno_{cuaderno_id}_*.json"
        backups = []
        for backup_path in self.backup_dir.glob(pattern):
            try:
                stat = backup_path.stat()
                backups.append({
                    "filename": backup_path.name,
                    "timestamp": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size": stat.st_size
                })
            except Exception:
                continue
        backups.sort(key=lambda x: x["timestamp"], reverse=True)
        return backups


# ============================================
# STORAGE SUPABASE (base de datos)
# ============================================

class SupabaseStorage:
    """
    Almacena cuadernos en Supabase PostgreSQL.
    Tabla: cuadernos (id TEXT PK, nombre TEXT, titular TEXT, data JSONB, ...)
    """

    def __init__(self):
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise ValueError(
                "Faltan SUPABASE_URL y/o SUPABASE_KEY en las variables de entorno. "
                "Configúralas en el .env o usa STORAGE_MODE=local"
            )
        self.client = create_client(url, key)
        self.table = "cuadernos"

    def crear(self, cuaderno: CuadernoExplotacion) -> CuadernoExplotacion:
        data = cuaderno.to_dict()
        # Verificar que no exista
        existing = self.client.table(self.table).select("id").eq("id", cuaderno.id).execute()
        if existing.data:
            raise ValueError(f"Ya existe un cuaderno con ID: {cuaderno.id}")

        self.client.table(self.table).insert({
            "id": cuaderno.id,
            "nombre": cuaderno.nombre_explotacion or "Sin nombre",
            "titular": cuaderno.titular or "",
            "anio": cuaderno.año,
            "data": data,
            "updated_at": datetime.now().isoformat()
        }).execute()
        return cuaderno

    def guardar(self, cuaderno: CuadernoExplotacion) -> CuadernoExplotacion:
        data = cuaderno.to_dict()
        row = {
            "id": cuaderno.id,
            "nombre": cuaderno.nombre_explotacion or "Sin nombre",
            "titular": cuaderno.titular or "",
            "anio": cuaderno.año,
            "data": data,
            "updated_at": datetime.now().isoformat()
        }
        # Upsert: inserta si no existe, actualiza si existe
        self.client.table(self.table).upsert(row).execute()
        return cuaderno

    def cargar(self, cuaderno_id: str) -> Optional[CuadernoExplotacion]:
        result = self.client.table(self.table).select("data").eq("id", cuaderno_id).execute()
        if not result.data:
            return None
        json_data = result.data[0]["data"]
        cuaderno = CuadernoExplotacion.from_dict(json_data)
        # Auto-reparación de tratamientos que mezclan parcelas de cultivos distintos.
        # + auto-reparación de históricos por Nº orden multi-parcela.
        # Idempotente: solo escribe en Supabase si hubo cambios reales.
        try:
            reparados_multi_cultivo = cuaderno.reparar_tratamientos_multi_cultivo()
            reparados_num_orden = cuaderno.reparar_tratamientos_num_orden_multi_parcela()
            restablecidos_individual = cuaderno.reestablecer_num_orden_individual_tratamientos()
            total_reparados = reparados_multi_cultivo + reparados_num_orden + restablecidos_individual
            if total_reparados > 0:
                self.guardar(cuaderno)
                print(
                    f"[auto-repair] Cuaderno {cuaderno_id}: "
                    f"{reparados_multi_cultivo} multi-cultivo + "
                    f"{reparados_num_orden} por Nº orden + "
                    f"{restablecidos_individual} restablecidos individuales."
                )
        except Exception as e:
            print(f"[auto-repair] Error reparando cuaderno {cuaderno_id}: {e}")
        return cuaderno

    def listar(self) -> List[Dict]:
        result = self.client.table(self.table).select(
            "id, nombre, titular, anio, updated_at, data"
        ).order("updated_at", desc=True).execute()

        cuadernos = []
        for row in result.data:
            data = row.get("data", {})
            cuadernos.append({
                "id": row["id"],
                "nombre_explotacion": row.get("nombre") or "Sin nombre",
                "titular": row.get("titular") or "",
                "año": row.get("anio"),
                "num_parcelas": len(data.get("parcelas", [])),
                "num_tratamientos": len(data.get("tratamientos", [])),
                "fecha_modificacion": row.get("updated_at"),
            })
        return cuadernos

    def eliminar(self, cuaderno_id: str) -> bool:
        result = self.client.table(self.table).select("id").eq("id", cuaderno_id).execute()
        if not result.data:
            return False
        self.client.table(self.table).delete().eq("id", cuaderno_id).execute()
        return True

    def restaurar_backup(self, cuaderno_id: str, timestamp: str = None) -> Optional[CuadernoExplotacion]:
        # En Supabase no gestionamos backups locales (Supabase tiene su propio sistema de backups)
        return None

    def listar_backups(self, cuaderno_id: str) -> List[Dict]:
        return []


# ============================================
# CLASE WRAPPER COMPATIBLE (misma interfaz)
# ============================================

class CuadernoStorage:
    """
    Wrapper que selecciona automáticamente el backend de almacenamiento
    según la variable STORAGE_MODE (local | supabase).
    En Render, si STORAGE_MODE no está definido pero hay SUPABASE_URL/KEY,
    usa Supabase para evitar pérdida de datos (disco efímero).
    """

    def __init__(self, base_dir: str = None):
        mode = os.environ.get("STORAGE_MODE", "").lower()
        on_render = os.environ.get("RENDER") == "true"
        has_supabase = bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"))

        # En Render con disco efímero: forzar Supabase si está configurado
        if on_render and has_supabase and mode != "supabase":
            if mode == "local":
                print("⚠️  RENDER: STORAGE_MODE=local pierde datos al reiniciar. Usando Supabase.")
            mode = "supabase"

        if mode == "supabase":
            if has_supabase:
                print("📦 Storage: Supabase (producción)")
                self._backend = SupabaseStorage()
            else:
                raise ValueError(
                    "STORAGE_MODE=supabase requiere SUPABASE_URL y SUPABASE_KEY. "
                    "Configúralas o usa STORAGE_MODE=local"
                )
        else:
            if on_render:
                print("⚠️  ADVERTENCIA: En Render el disco es efímero. Los cuadernos se perderán al reiniciar.")
                print("   Para persistencia: STORAGE_MODE=supabase + SUPABASE_URL + SUPABASE_KEY")
            print("📁 Storage: Local (desarrollo)")
            self._backend = LocalStorage(base_dir)

    def crear(self, cuaderno):
        return self._backend.crear(cuaderno)

    def guardar(self, cuaderno):
        return self._backend.guardar(cuaderno)

    def cargar(self, cuaderno_id):
        return self._backend.cargar(cuaderno_id)

    def listar(self):
        return self._backend.listar()

    def eliminar(self, cuaderno_id):
        return self._backend.eliminar(cuaderno_id)

    def restaurar_backup(self, cuaderno_id, timestamp=None):
        return self._backend.restaurar_backup(cuaderno_id, timestamp)

    def listar_backups(self, cuaderno_id):
        return self._backend.listar_backups(cuaderno_id)


# ============================================
# INSTANCIA GLOBAL
# ============================================

_storage: Optional[CuadernoStorage] = None


def get_storage() -> CuadernoStorage:
    """Obtiene la instancia global del storage"""
    global _storage
    if _storage is None:
        _storage = CuadernoStorage()
    return _storage
