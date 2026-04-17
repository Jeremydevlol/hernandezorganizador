"""
CATÁLOGO GLOBAL DE PRODUCTOS FITOSANITARIOS / FERTILIZANTES

Catálogo compartido entre todos los cuadernos. No pertenece a ningún cuaderno.
Se usa para:
- Autocompletar al añadir productos a un tratamiento (aunque el producto no exista
  todavía en el inventario del cuaderno).
- Evitar duplicar datos de productos que ya usamos en otras explotaciones.

Modos de persistencia:
  - "local"    → archivo JSON único en disco
  - "supabase" → tabla "productos_globales" en PostgreSQL

La selección se hace igual que en storage.CuadernoStorage (STORAGE_MODE /
variables de entorno).
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


CAMPOS = (
    "id",
    "nombre_comercial",
    "numero_registro",
    "materia_activa",
    "formulacion",
    "tipo",
    "unidad",
    "proveedor",
    "notas",
    "created_at",
    "updated_at",
)


def _normalizar_entrada(data: Dict) -> Dict:
    """Rellena campos mínimos, pone id si falta y actualiza timestamps."""
    now = datetime.now().isoformat()
    out = {k: (data.get(k) or "") for k in CAMPOS}
    out["id"] = out["id"] or str(uuid.uuid4())[:12]
    if not out["tipo"]:
        out["tipo"] = "fitosanitario"
    if not out["unidad"]:
        out["unidad"] = "L"
    out["created_at"] = data.get("created_at") or now
    out["updated_at"] = now
    return out


def _clave_unicidad(row: Dict) -> str:
    nombre = (row.get("nombre_comercial") or "").strip().lower()
    reg = (row.get("numero_registro") or "").strip().lower()
    return f"{nombre}||{reg}"


# ============================================
# LOCAL STORAGE (JSON)
# ============================================

class LocalCatalogoStorage:
    """Almacena el catálogo global como JSON en disco."""

    def __init__(self, filepath: Optional[str] = None):
        if filepath is None:
            base_dir = Path(__file__).parent.parent / "cuadernos_data"
            base_dir.mkdir(parents=True, exist_ok=True)
            filepath = base_dir / "productos_globales.json"
        self.filepath = Path(filepath)
        if not self.filepath.exists():
            self.filepath.write_text(json.dumps({"productos": []}, ensure_ascii=False, indent=2), encoding="utf-8")

    def _leer(self) -> List[Dict]:
        try:
            data = json.loads(self.filepath.read_text(encoding="utf-8"))
        except Exception:
            data = {}
        rows = data.get("productos") or []
        return [r for r in rows if isinstance(r, dict)]

    def _escribir(self, rows: List[Dict]) -> None:
        self.filepath.write_text(
            json.dumps({"productos": rows}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def listar(self, q: str = "", limit: int = 50) -> List[Dict]:
        rows = self._leer()
        q_norm = (q or "").strip().lower()
        if q_norm:
            def match(r: Dict) -> bool:
                for field in ("nombre_comercial", "numero_registro", "materia_activa", "formulacion"):
                    if q_norm in (r.get(field) or "").lower():
                        return True
                return False
            rows = [r for r in rows if match(r)]
        rows.sort(key=lambda r: (r.get("nombre_comercial") or "").lower())
        return rows[: max(1, int(limit or 50))]

    def obtener(self, producto_id: str) -> Optional[Dict]:
        for r in self._leer():
            if r.get("id") == producto_id:
                return r
        return None

    def upsert(self, data: Dict) -> Dict:
        rows = self._leer()
        nuevo = _normalizar_entrada(data)
        clave = _clave_unicidad(nuevo)
        # Si ya existe uno con misma (nombre+registro), actualizar.
        for i, r in enumerate(rows):
            if _clave_unicidad(r) == clave:
                nuevo["id"] = r.get("id") or nuevo["id"]
                nuevo["created_at"] = r.get("created_at") or nuevo["created_at"]
                rows[i] = nuevo
                self._escribir(rows)
                return nuevo
        rows.append(nuevo)
        self._escribir(rows)
        return nuevo

    def actualizar(self, producto_id: str, patch: Dict) -> Optional[Dict]:
        rows = self._leer()
        for i, r in enumerate(rows):
            if r.get("id") == producto_id:
                merged = {**r, **{k: v for k, v in (patch or {}).items() if k in CAMPOS and k not in ("id", "created_at")}}
                merged["updated_at"] = datetime.now().isoformat()
                rows[i] = merged
                self._escribir(rows)
                return merged
        return None

    def eliminar(self, producto_id: str) -> bool:
        rows = self._leer()
        nuevos = [r for r in rows if r.get("id") != producto_id]
        if len(nuevos) == len(rows):
            return False
        self._escribir(nuevos)
        return True


# ============================================
# SUPABASE STORAGE
# ============================================

class SupabaseCatalogoStorage:
    """
    Almacena el catálogo global en Supabase.
    Tabla: productos_globales (id TEXT PK, nombre_comercial TEXT, ...).
    """

    def __init__(self):
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise ValueError(
                "SupabaseCatalogoStorage requiere SUPABASE_URL y SUPABASE_KEY."
            )
        self.client = create_client(url, key)
        self.table = "productos_globales"

    def listar(self, q: str = "", limit: int = 50) -> List[Dict]:
        query = self.client.table(self.table).select("*")
        q_norm = (q or "").strip()
        if q_norm:
            # búsqueda case-insensitive en 4 columnas
            like = f"%{q_norm}%"
            query = query.or_(
                f"nombre_comercial.ilike.{like},"
                f"numero_registro.ilike.{like},"
                f"materia_activa.ilike.{like},"
                f"formulacion.ilike.{like}"
            )
        query = query.order("nombre_comercial").limit(max(1, int(limit or 50)))
        result = query.execute()
        return list(result.data or [])

    def obtener(self, producto_id: str) -> Optional[Dict]:
        result = self.client.table(self.table).select("*").eq("id", producto_id).execute()
        if result.data:
            return result.data[0]
        return None

    def upsert(self, data: Dict) -> Dict:
        nuevo = _normalizar_entrada(data)
        # upsert con on_conflict por el índice único (nombre_comercial+numero_registro).
        # Si falla (p.ej. sin índice único o Postgrest lo rechaza), hacemos búsqueda + update/insert manual.
        try:
            resp = self.client.table(self.table).upsert(nuevo).execute()
            if resp.data:
                return resp.data[0]
        except Exception:
            pass
        # Fallback manual
        existing = self.client.table(self.table).select("id,created_at")\
            .ilike("nombre_comercial", nuevo["nombre_comercial"])\
            .ilike("numero_registro", nuevo["numero_registro"] or "")\
            .execute()
        if existing.data:
            nuevo["id"] = existing.data[0]["id"]
            nuevo["created_at"] = existing.data[0].get("created_at") or nuevo["created_at"]
            self.client.table(self.table).update(nuevo).eq("id", nuevo["id"]).execute()
        else:
            self.client.table(self.table).insert(nuevo).execute()
        return nuevo

    def actualizar(self, producto_id: str, patch: Dict) -> Optional[Dict]:
        current = self.obtener(producto_id)
        if not current:
            return None
        merged = {**current, **{k: v for k, v in (patch or {}).items() if k in CAMPOS and k not in ("id", "created_at")}}
        merged["updated_at"] = datetime.now().isoformat()
        self.client.table(self.table).update(merged).eq("id", producto_id).execute()
        return merged

    def eliminar(self, producto_id: str) -> bool:
        existing = self.client.table(self.table).select("id").eq("id", producto_id).execute()
        if not existing.data:
            return False
        self.client.table(self.table).delete().eq("id", producto_id).execute()
        return True


# ============================================
# WRAPPER PÚBLICO + FACTORY
# ============================================

class CatalogoProductos:
    """
    Wrapper que delega en el backend correcto según STORAGE_MODE.
    Misma lógica que storage.CuadernoStorage: Supabase en producción, JSON en local.
    """

    def __init__(self):
        mode = os.environ.get("STORAGE_MODE", "").lower()
        on_render = os.environ.get("RENDER") == "true"
        has_supabase = bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"))

        if on_render and has_supabase and mode != "supabase":
            mode = "supabase"

        if mode == "supabase":
            if has_supabase:
                self._backend = SupabaseCatalogoStorage()
            else:
                raise ValueError("STORAGE_MODE=supabase pero faltan SUPABASE_URL/SUPABASE_KEY.")
        else:
            self._backend = LocalCatalogoStorage()

    def listar(self, q: str = "", limit: int = 50) -> List[Dict]:
        return self._backend.listar(q=q, limit=limit)

    def obtener(self, producto_id: str) -> Optional[Dict]:
        return self._backend.obtener(producto_id)

    def upsert(self, data: Dict) -> Dict:
        return self._backend.upsert(data)

    def actualizar(self, producto_id: str, patch: Dict) -> Optional[Dict]:
        return self._backend.actualizar(producto_id, patch)

    def eliminar(self, producto_id: str) -> bool:
        return self._backend.eliminar(producto_id)


_catalogo_instance: Optional[CatalogoProductos] = None


def get_catalogo() -> CatalogoProductos:
    """Singleton del catálogo global."""
    global _catalogo_instance
    if _catalogo_instance is None:
        _catalogo_instance = CatalogoProductos()
    return _catalogo_instance
