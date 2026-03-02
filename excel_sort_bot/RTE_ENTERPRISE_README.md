# 🔥 RTE Enterprise v2.0 - Sistema Completo

## Estado: ✅ PRODUCCIÓN LOCAL

Último test: 2026-02-05 03:08
Tests pasados: **85/85** (100%)

---

## 📁 Arquitectura

```
src/
├── workbook_rte.py              # Motor RTE (14 operaciones)
├── rte_ai_processor.py          # IA con OpenAI
├── rte_api.py                   # API endpoints
├── rte_semantic_resolver.py     # "orden 39" → fila 67
├── rte_contract_validator.py    # Guardrails + Lock + Tamper
└── rte_fuzzy_resolver.py        # "glifosato" → ROUNDUP
```

---

## 🔧 Uso Rápido

```python
from src.rte_api import (
    rte_start_session,
    rte_preview,
    rte_commit,
    rte_resolve,
    rte_validate,
    rte_undo,
    rte_close
)

# 1. Iniciar sesión (adquiere lock)
session = rte_start_session("cuaderno.xlsx", mode="ADMIN")
session_id = session["session_id"]

# 2. Resolver referencia semántica
resolve = rte_resolve(session_id, "orden 39", field="fecha")
# → {'cells': ['E67'], 'description': 'Orden 39 → fila 67 (ROUNDUP)'}

# 3. Validar valor
validate = rte_validate(session_id, "inf.trat 1", "E67", "25/03/2026")
# → {'valid': True, 'normalized_value': datetime(2026, 3, 25)}

# 4. Preview con IA
preview = rte_preview(
    session_id=session_id,
    instruction="Cambia la fecha del orden 39 a 25/03/2026",
    use_ai=True
)

# 5. Commit (ops destructivas requieren force=True)
commit = rte_commit(session_id, preview["proposal_id"])

# 6. Cerrar (libera lock)
rte_close(session_id)
```

---

## 🛡️ Blindajes Activos

| Blindaje | Descripción |
|----------|-------------|
| **Semantic Resolver** | "orden 39", "parcela 15-234-1", "último tratamiento" |
| **Fuzzy Resolver** | "glifosato" → ROUNDUP, con alternativas |
| **Contract Validator** | Tipos, filas/hojas protegidas |
| **Sheet Aliases** | "tratamientos" → inf.trat 1 |
| **Tamper-proof** | ops_hash + checksum_before + TTL |
| **File Locking** | 1 sesión por archivo |
| **Destructive Guards** | DELETE_* requiere confirmación |

---

## 📋 Modos de Permiso

| Modo | Operaciones |
|------|-------------|
| **STRICT** | SET_CELL, SET_RANGE |
| **POWER** | + FIND_REPLACE, INSERT_ROWS, DELETE_ROWS |
| **ADMIN** | + RENAME_SHEET, DELETE_SHEET, SET_FORMULA |

---

## ⚠️ Operaciones Destructivas

Siempre requieren `requires_confirmation=True`:
- `DELETE_ROWS`
- `DELETE_SHEET`

Para ejecutar: `rte_commit(session_id, proposal_id, force=True)`

---

## 📊 Tests Disponibles

```bash
# Suite completa
python3 test_rte_v2.py
python3 test_enterprise_blindajes.py
python3 test_fuzzy_resolver.py
python3 test_destructive_guards.py
python3 test_enterprise_final.py
python3 test_casos_reales.py
```

---

## 🚀 Pendiente para Multiinstancia

Cuando escalen a 2+ instancias (Docker/K8s):
1. `sessions_store` → Redis
2. `proposals_store` → Redis  
3. `locks_store` → Redis con advisory locks

Por ahora: **todo en memoria, producción local OK**.

---

## 📦 Dependencias

```
openpyxl>=3.1.0
pydantic>=2.0.0
openai>=1.0.0  # Para IA
python-dotenv  # Para .env
```

---

**Autor**: Antigravity  
**Versión**: 2.0 Enterprise  
**Fecha**: 2026-02-05
