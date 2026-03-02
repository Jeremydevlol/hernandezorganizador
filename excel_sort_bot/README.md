# Hernandez Bueno Sort Bot 🤖📊

**Ordenador profesional de Excels "base" desordenados usando una plantilla RESUELTO**

Bot inteligente que extrae datos de Excels con estructuras variables y los organiza en una plantilla estandarizada, manteniendo estilos, formatos y fórmulas.

## ✨ Características

- 🔍 **Extracción robusta**: Encuentra datos por etiquetas, patrones regex o tablas
- 🎨 **Preserva estilos**: Usa la plantilla RESUELTO tal cual, solo rellena valores
- ✅ **Validación completa**: NIF/NIE español, fechas, importes, campos obligatorios
- 📝 **Logging detallado**: Hoja LOG en output + JSON de errores
- 🔄 **Transformaciones**: Parse money, dates, normalización de texto
- 📁 **Batch processing**: Procesa carpetas completas
- ⚙️ **Configurable**: Mapping JSON flexible para cualquier estructura

## 🚀 Instalación

### Requisitos
- Python 3.11+
- pip

### Opción 1: Con pip
```bash
cd excel_sort_bot
pip install -r requirements.txt
```

### Opción 2: Con pyproject.toml
```bash
cd excel_sort_bot
pip install .
```

### Dependencias
- `openpyxl` - Lectura/escritura de Excel
- `python-dateutil` - Parsing de fechas
- `pytest` - Tests (opcional, dev)

## 📋 Uso

### Archivo único
```bash
python run.py \
  --input base.xlsx \
  --template "PABLO PEREZ RUBIO 2025 RESUELTO.XLSX" \
  --output final.xlsx
```

### Carpeta completa (batch)
```bash
python run.py \
  --input-dir ./bases \
  --template "PABLO PEREZ RUBIO 2025 RESUELTO.XLSX" \
  --output-dir ./salidas
```

### Con opciones
```bash
python run.py \
  --input base.xlsx \
  --template resuelto.xlsx \
  --output final.xlsx \
  --mapping config/mapping.json \
  --strict \
  --debug
```

### Opciones disponibles

| Opción | Descripción |
|--------|-------------|
| `--input`, `-i` | Archivo Excel base a procesar |
| `--input-dir` | Directorio con archivos Excel base |
| `--template`, `-t` | Archivo plantilla RESUELTO (obligatorio) |
| `--output`, `-o` | Archivo de salida |
| `--output-dir` | Directorio de salida |
| `--mapping`, `-m` | Archivo mapping JSON (default: config/mapping.json) |
| `--strict` | No genera output si hay errores |
| `--debug` | Muestra mensajes detallados |

## ⚙️ Configuración (mapping.json)

El archivo `config/mapping.json` define cómo extraer cada campo:

```json
{
  "meta": {
    "template_default_sheet": "inf.gral 1",
    "log_sheet_name": "LOG"
  },
  "fields": [
    {
      "key": "nombre_titular",
      "required": true,
      "source": {
        "type": "label",
        "labels": ["Nombre y apellidos", "Titular", "NOMBRE"],
        "take": "right",
        "max_distance": 3
      },
      "target": {
        "sheet": "inf.gral 1",
        "cell": "D9"
      },
      "transforms": ["strip", "uppercase"]
    }
  ]
}
```

### Tipos de source

| Tipo | Descripción |
|------|-------------|
| `label` | Busca por etiqueta de texto |
| `pattern` | Busca por regex (nif_nie, money, date, email, phone) |
| `label_or_pattern` | Primero label, luego pattern |
| `table` | Extrae datos de tablas estructuradas |

### Direcciones (take)

| Valor | Descripción |
|-------|-------------|
| `right` | Valor a la derecha de la etiqueta |
| `down` | Valor debajo de la etiqueta |
| `left` | Valor a la izquierda |
| `up` | Valor arriba |

### Transformaciones disponibles

| Transform | Descripción |
|-----------|-------------|
| `strip` | Quita espacios |
| `uppercase` | MAYÚSCULAS |
| `lowercase` | minúsculas |
| `title_case` | Title Case |
| `parse_money` | Convierte a float (acepta €, EUR, 1.234,56) |
| `round_2` | Redondea a 2 decimales |
| `parse_date` | Convierte a fecha |
| `validate_nif_nie` | Valida NIF/NIE español |
| `clean_nif` | Limpia separadores del NIF |
| `empty_to_none` | Vacío → None |
| `to_text` | Fuerza a string |

## 📊 Outputs

### Archivo Excel final
- Copia de la plantilla con valores rellenados
- Hoja `LOG` con:
  - Timestamp
  - Campo procesado
  - Estado (OK/WARN/ERROR)
  - Método de extracción
  - Valor original y transformado
  - Celdas origen y destino

### Archivo de errores (JSON)
Si hay errores de validación:
```json
{
  "generated_at": "2025-02-03T01:05:00",
  "total_errors": 2,
  "errors": [
    {
      "field": "nif_titular",
      "type": "required_missing",
      "message": "Campo obligatorio 'nif_titular' no encontrado",
      "source_sheet": null,
      "source_cell": null
    }
  ]
}
```

## 🧪 Tests

```bash
# Ejecutar todos los tests
python -m pytest tests/ -v

# Solo tests de parsers
python -m pytest tests/test_parsers.py -v

# Con cobertura
python -m pytest tests/ --cov=src --cov-report=html
```

## 📁 Estructura del proyecto

```
excel_sort_bot/
├── run.py                  # CLI principal
├── pyproject.toml          # Configuración del proyecto
├── requirements.txt        # Dependencias
├── README.md               # Este archivo
├── config/
│   └── mapping.json        # Configuración de campos
├── src/
│   ├── __init__.py
│   ├── types.py            # Tipos de datos
│   ├── io_excel.py         # Lectura/escritura Excel
│   ├── extractors.py       # Estrategias de extracción
│   ├── transformers.py     # Transformaciones de datos
│   ├── validators.py       # Validaciones
│   ├── writers.py          # Escritura a plantilla
│   └── logger.py           # Sistema de logging
└── tests/
    ├── __init__.py
    └── test_parsers.py     # Tests de parsers
```

## 🇪🇸 Validación NIF/NIE

El bot valida NIFs y NIEs españoles según el algoritmo oficial:
- **NIF**: 8 dígitos + letra de control
- **NIE**: X/Y/Z + 7 dígitos + letra de control
- **CIF**: Letra inicial + dígitos (sociedades)

## 🔧 Personalización

### Añadir un nuevo campo

1. Edita `config/mapping.json`
2. Añade una entrada en `fields`:
```json
{
  "key": "mi_nuevo_campo",
  "required": false,
  "source": {
    "type": "label",
    "labels": ["Etiqueta 1", "Etiqueta alternativa"],
    "take": "right",
    "max_distance": 2
  },
  "target": {
    "sheet": "Hoja1",
    "cell": "B10"
  },
  "transforms": ["strip"]
}
```

### Añadir un nuevo transformador

Edita `src/transformers.py`:
```python
def transform_mi_custom(value: Any) -> Any:
    # Tu lógica aquí
    return resultado

# Registrar
TRANSFORM_REGISTRY["mi_custom"] = transform_mi_custom
```

## 📝 Ejemplo de uso real

```bash
# Procesar cuaderno de explotación agrícola
python run.py \
  --input "GARCIA MARTINEZ 2024 BASE.xlsx" \
  --template "PABLO PEREZ RUBIO 2025 RESUELTO.XLSX" \
  --output "GARCIA MARTINEZ 2024 ORDENADO.xlsx" \
  --debug
```

Output esperado:
```
============================================================
EXCEL SORT BOT - Ordenador de Excels
============================================================
Mapping: config/mapping.json
Campos configurados: 16
[INFO] Procesando: GARCIA MARTINEZ 2024 BASE.xlsx
[INFO] Hojas encontradas en base: ['Datos', 'Parcelas', 'Tratamientos']
[Extractor] Label encontrado: 'Nombre y apellidos o razón social:' en Datos!A9
[Extractor]   -> Valor encontrado: 'GARCIA MARTINEZ JUAN' en D9
[INFO] Campo 'nombre_titular': OK (fuente: Datos!D9) = GARCIA MARTINEZ JUAN
...
[INFO] Archivo generado: GARCIA MARTINEZ 2024 ORDENADO.xlsx

Resumen: OK=14, WARN=2, ERROR=0
```

## 🤝 Contribuir

1. Fork el repo
2. Crea tu rama (`git checkout -b feature/mi-mejora`)
3. Commit (`git commit -am 'Añade nueva funcionalidad'`)
4. Push (`git push origin feature/mi-mejora`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver LICENSE para más detalles.

---

**Desarrollado para automatizar la organización de Cuadernos de Explotación Agrícola en España** 🌾
