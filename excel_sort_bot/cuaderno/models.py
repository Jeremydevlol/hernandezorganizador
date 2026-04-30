"""
CUADERNO DE EXPLOTACIÓN AGRÍCOLA - MODELOS DE DATOS
Conforme a requisitos del Ministerio de Agricultura de España.

v1.0 MVP - Gestión de Parcelas, Productos y Tratamientos
"""
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum
import json
import os
import uuid


# ============================================
# ENUMS
# ============================================

class EstadoTratamiento(Enum):
    PENDIENTE = "pendiente"
    APLICADO = "aplicado"
    CANCELADO = "cancelado"


class TipoProducto(Enum):
    FITOSANITARIO = "fitosanitario"
    FERTILIZANTE = "fertilizante"
    BIOLOGICO = "biologico"
    OTRO = "otro"


# ============================================
# MODELOS BASE
# ============================================

@dataclass
class Parcela:
    """
    Representa una parcela del cuaderno de explotación.
    Formato oficial SIGPAC según Excel del Ministerio de Agricultura de España.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    num_orden: int = 0                      # Nº de Orden
    # Referencias SIGPAC
    codigo_provincia: str = ""              # Código Provincia (ej: "37")
    termino_municipal: str = ""             # Término Municipal (ej: "108-COCA DE ALBA")
    codigo_agregado: str = ""               # Código Agregado
    zona: str = ""                          # Zona
    num_poligono: str = ""                  # Nº Polígono
    num_parcela: str = ""                   # Nº Parcela
    num_recinto: str = ""                   # Nº Recinto
    uso_sigpac: str = ""                    # Uso SIGPAC (ej: "TA")
    # Superficies
    superficie_sigpac: float = 0.0          # Superficie SIGPAC (ha)
    superficie_cultivada: float = 0.0       # Superficie Cultivada (ha)
    # Datos agronómicos
    especie: str = ""                       # Especie (ej: "CEBADA", "TRIGO BLANDO")
    ecoregimen: str = ""                    # Ecoregimen/Práctica (ej: "P3", "P5")
    secano_regadio: str = ""                # S/R
    cultivo_tipo: str = ""                  # Principal/Secundario
    fecha_inicio_cultivo: str = ""          # Fecha inicio
    fecha_fin_cultivo: str = ""             # Fecha fin
    aire_libre_protegido: str = ""          # Aire libre o protegido
    sistema_asesoramiento: str = ""         # Sistema asesoramiento
    zona_nitratos: bool = False             # Zona vulnerable nitratos
    # Campos compatibilidad/alias
    nombre: str = ""                        # Nombre descriptivo
    referencia_catastral: str = ""          # Ref. catastral completa
    superficie_ha: float = 0.0              # Superficie (alias para superficie_cultivada)
    cultivo: str = ""                       # Cultivo (alias para especie)
    variedad: str = ""                      # Variedad
    municipio: str = ""                     # Municipio (derivado de termino_municipal)
    provincia: str = ""                     # Provincia
    notas: str = ""
    activa: bool = True
    color_fila: str = ""                    # Marcar fila en el editor (hex); vacío = blanco
    fecha_creacion: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "num_orden": self.num_orden,
            # SIGPAC
            "codigo_provincia": self.codigo_provincia,
            "termino_municipal": self.termino_municipal,
            "codigo_agregado": self.codigo_agregado,
            "zona": self.zona,
            "num_poligono": self.num_poligono,
            "num_parcela": self.num_parcela,
            "num_recinto": self.num_recinto,
            "uso_sigpac": self.uso_sigpac,
            "superficie_sigpac": self.superficie_sigpac,
            "superficie_cultivada": self.superficie_cultivada,
            "especie": self.especie,
            "ecoregimen": self.ecoregimen,
            "secano_regadio": self.secano_regadio,
            "cultivo_tipo": self.cultivo_tipo,
            "fecha_inicio_cultivo": self.fecha_inicio_cultivo,
            "fecha_fin_cultivo": self.fecha_fin_cultivo,
            "aire_libre_protegido": self.aire_libre_protegido,
            "sistema_asesoramiento": self.sistema_asesoramiento,
            "zona_nitratos": self.zona_nitratos,
            # Compatibilidad
            "nombre": self.nombre,
            "referencia_catastral": self.referencia_catastral,
            "superficie_ha": self.superficie_ha or self.superficie_cultivada,
            "cultivo": self.cultivo or self.especie,
            "variedad": self.variedad,
            "municipio": self.municipio or self.termino_municipal,
            "provincia": self.provincia or self.codigo_provincia,
            "notas": self.notas,
            "activa": self.activa,
            "color_fila": self.color_fila or "",
            "fecha_creacion": self.fecha_creacion
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Parcela':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class ProductoFitosanitario:
    """Producto fitosanitario registrado (inventario)"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    nombre_comercial: str = ""
    numero_registro: str = ""  # Nº registro fitosanitario
    materia_activa: str = ""
    formulacion: str = ""
    tipo: TipoProducto = TipoProducto.FITOSANITARIO
    numero_lote: str = ""
    cantidad_adquirida: float = 0.0
    unidad: str = "L"  # L, Kg, etc.
    fecha_adquisicion: str = ""
    proveedor: str = ""
    fecha_caducidad: str = ""
    notas: str = ""
    color_fila: str = ""
    fecha_creacion: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre_comercial": self.nombre_comercial,
            "numero_registro": self.numero_registro,
            "materia_activa": self.materia_activa,
            "formulacion": self.formulacion,
            "tipo": self.tipo.value if isinstance(self.tipo, TipoProducto) else self.tipo,
            "numero_lote": self.numero_lote,
            "cantidad_adquirida": self.cantidad_adquirida,
            "unidad": self.unidad,
            "fecha_adquisicion": self.fecha_adquisicion,
            "proveedor": self.proveedor,
            "fecha_caducidad": self.fecha_caducidad,
            "notas": self.notas,
            "color_fila": self.color_fila or "",
            "fecha_creacion": self.fecha_creacion
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ProductoFitosanitario':
        d = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        if 'tipo' in d and isinstance(d['tipo'], str):
            d['tipo'] = TipoProducto(d['tipo'])
        return cls(**d)


@dataclass
class ProductoAplicado:
    """Producto aplicado dentro de un tratamiento (snapshot: nombre, registro, lote)"""
    producto_id: str = ""
    nombre_comercial: str = ""   # Copia para histórico
    numero_registro: str = ""    # Copia para histórico
    numero_lote: str = ""        # Copia para histórico / trazabilidad
    problema_fitosanitario: str = ""  # Plaga/enfermedad específica de este producto
    dosis: float = 0.0
    unidad_dosis: str = "L/Ha"   # L/Ha, Kg/Ha, cc/L, g/L
    caldo_hectarea: float = 0.0
    notas: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "producto_id": self.producto_id,
            "nombre_comercial": self.nombre_comercial,
            "numero_registro": self.numero_registro,
            "numero_lote": self.numero_lote,
            "problema_fitosanitario": self.problema_fitosanitario,
            "dosis": self.dosis,
            "unidad_dosis": self.unidad_dosis,
            "caldo_hectarea": self.caldo_hectarea,
            "notas": self.notas
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ProductoAplicado':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Tratamiento:
    """
    Tratamiento fitosanitario aplicado.
    Formato oficial según inf.trat 1 del Cuaderno de Explotación.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    # Identificación parcelas
    parcela_ids: List[str] = field(default_factory=list)
    parcela_nombres: List[str] = field(default_factory=list)
    num_orden_parcelas: str = ""             # Ej: "7,8,9" como en Excel
    # Cultivo
    cultivo_especie: str = ""                # TRIGO BLANDO, CEBADA, etc.
    cultivo_variedad: str = ""               # Variedad
    superficie_tratada: float = 0.0          # Superficie tratada (ha)
    # Aplicación
    fecha_aplicacion: str = ""
    problema_fitosanitario: str = ""         # MALAS HIERBAS, INSECTICIDA, etc.
    aplicador: str = ""                      # ID/Nombre del aplicador
    equipo: str = ""                         # ID/Nombre del equipo
    # Productos
    productos: List[ProductoAplicado] = field(default_factory=list)
    # Resultado
    eficacia: str = ""                       # BUENA, REGULAR, MALA
    observaciones: str = ""
    # Campos adicionales
    justificacion: str = ""
    metodo_aplicacion: str = ""
    condiciones_climaticas: str = ""
    hora_inicio: str = ""
    hora_fin: str = ""
    estado: EstadoTratamiento = EstadoTratamiento.APLICADO
    # Compatibilidad
    plaga_enfermedad: str = ""               # Alias de problema_fitosanitario
    operador: str = ""                       # Alias de aplicador
    fecha_creacion: str = field(default_factory=lambda: datetime.now().isoformat())
    color_fila: str = ""                     # Color de fondo para marcar (hex, ej: #fef3c7). Vacío = blanco
    # Asesoramiento vinculado al tratamiento
    asesorado: bool = False
    nombre_asesor_trat: str = ""            # Nombre del asesor que recomienda
    num_colegiado_asesor: str = ""          # Nº colegiado / habilitación del asesor
    fecha_recomendacion_asesor: str = ""    # Fecha de la recomendación
    firma_asesor: str = ""                  # Firma del asesor (base64 PNG)
    firma_cliente: str = ""                 # Firma del cliente/titular (base64 PNG)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "parcela_ids": self.parcela_ids,
            "parcela_nombres": self.parcela_nombres,
            "num_orden_parcelas": self.num_orden_parcelas,
            "cultivo_especie": self.cultivo_especie,
            "cultivo_variedad": self.cultivo_variedad,
            "superficie_tratada": self.superficie_tratada,
            "fecha_aplicacion": self.fecha_aplicacion,
            "problema_fitosanitario": self.problema_fitosanitario or self.plaga_enfermedad,
            "aplicador": self.aplicador or self.operador,
            "equipo": self.equipo,
            "productos": [p.to_dict() if hasattr(p, 'to_dict') else p for p in self.productos],
            "eficacia": self.eficacia,
            "observaciones": self.observaciones,
            "justificacion": self.justificacion,
            "metodo_aplicacion": self.metodo_aplicacion,
            "condiciones_climaticas": self.condiciones_climaticas,
            "hora_inicio": self.hora_inicio,
            "hora_fin": self.hora_fin,
            "estado": self.estado.value if isinstance(self.estado, EstadoTratamiento) else self.estado,
            # Alias
            "plaga_enfermedad": self.plaga_enfermedad or self.problema_fitosanitario,
            "operador": self.operador or self.aplicador,
            "fecha_creacion": self.fecha_creacion,
            "color_fila": self.color_fila or "",
            # Asesoramiento
            "asesorado": self.asesorado,
            "nombre_asesor_trat": self.nombre_asesor_trat or "",
            "num_colegiado_asesor": self.num_colegiado_asesor or "",
            "fecha_recomendacion_asesor": self.fecha_recomendacion_asesor or "",
            "firma_asesor": self.firma_asesor or "",
            "firma_cliente": self.firma_cliente or "",
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Tratamiento':
        d = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        if 'productos' in d:
            d['productos'] = [ProductoAplicado.from_dict(p) if isinstance(p, dict) else p 
                             for p in d['productos']]
        if 'estado' in d and isinstance(d['estado'], str):
            d['estado'] = EstadoTratamiento(d['estado'])
        return cls(**d)


@dataclass
class Fertilizacion:
    """Registro de fertilización (abonos, enmiendas)."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    fecha_inicio: str = ""
    fecha_fin: str = ""
    num_orden_parcelas: str = ""       # Nº orden parcelas (ej: "7,8,9")
    cultivo_especie: str = ""
    cultivo_variedad: str = ""
    tipo_abono: str = ""
    riqueza_npk: str = ""               # N/P/K (ej: "20-10-10")
    dosis: str = ""
    tipo_fertilizacion: str = ""
    observaciones: str = ""
    color_fila: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "fecha_inicio": self.fecha_inicio,
            "fecha_fin": self.fecha_fin,
            "num_orden_parcelas": self.num_orden_parcelas,
            "cultivo_especie": self.cultivo_especie,
            "cultivo_variedad": self.cultivo_variedad,
            "tipo_abono": self.tipo_abono,
            "riqueza_npk": self.riqueza_npk,
            "dosis": self.dosis,
            "tipo_fertilizacion": self.tipo_fertilizacion,
            "observaciones": self.observaciones,
            "color_fila": self.color_fila or "",
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Fertilizacion':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Cosecha:
    """Registro de cosecha/venta de producto."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    fecha: str = ""
    producto: str = ""
    cantidad_kg: float = 0.0
    num_orden_parcelas: str = ""
    num_albaran: str = ""
    num_lote: str = ""
    cliente_nombre: str = ""
    cliente_nif: str = ""
    cliente_direccion: str = ""
    cliente_rgseaa: str = ""
    color_fila: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "fecha": self.fecha,
            "producto": self.producto,
            "cantidad_kg": self.cantidad_kg,
            "num_orden_parcelas": self.num_orden_parcelas,
            "num_albaran": self.num_albaran,
            "num_lote": self.num_lote,
            "cliente_nombre": self.cliente_nombre,
            "cliente_nif": self.cliente_nif,
            "cliente_direccion": self.cliente_direccion,
            "cliente_rgseaa": self.cliente_rgseaa,
            "color_fila": self.color_fila or "",
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Cosecha':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Asesoramiento:
    """Registro de asesoramiento fitosanitario (Hoja 3.2 oficial).
    Obligatorio para Patata y Remolacha ≥5 ha.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    fecha: str = ""
    num_orden_parcelas: str = ""       # Nº orden parcelas afectadas (ej: "7,8")
    cultivo_especie: str = ""
    cultivo_variedad: str = ""
    superficie_ha: float = 0.0
    nombre_asesor: str = ""
    num_habilitacion: str = ""         # Nº habilitación del asesor
    tipo_asesoramiento: str = ""       # Visita, Plan anual, etc.
    recomendacion: str = ""
    observaciones: str = ""
    color_fila: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "fecha": self.fecha,
            "num_orden_parcelas": self.num_orden_parcelas,
            "cultivo_especie": self.cultivo_especie,
            "cultivo_variedad": self.cultivo_variedad,
            "superficie_ha": self.superficie_ha,
            "nombre_asesor": self.nombre_asesor,
            "num_habilitacion": self.num_habilitacion,
            "tipo_asesoramiento": self.tipo_asesoramiento,
            "recomendacion": self.recomendacion,
            "observaciones": self.observaciones,
            "color_fila": self.color_fila or "",
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Asesoramiento':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class HojaExcel:
    """Representa una hoja de Excel importada. Toda hoja entra, se ve, se edita y se conserva."""
    sheet_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str = ""
    columnas: List[str] = field(default_factory=list)
    datos: List[List[Any]] = field(default_factory=list)
    tipo: str = "custom"  # parcelas, productos, tratamientos, custom
    origen: str = "importado"  # importado | importado_editable (tras primera edición)
    
    def to_dict(self) -> Dict:
        return {
            "sheet_id": self.sheet_id,
            "nombre": self.nombre,
            "columnas": self.columnas,
            "datos": self.datos,
            "tipo": self.tipo,
            "origen": self.origen,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'HojaExcel':
        kwargs = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        if "sheet_id" not in kwargs or not kwargs["sheet_id"]:
            kwargs["sheet_id"] = str(uuid.uuid4())
        return cls(**kwargs)


@dataclass
class StockEntrada:
    """Registro de entrada de stock (compra/recepción de producto)."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    producto_id: str = ""
    nombre_comercial: str = ""   # snapshot del nombre en el momento de la entrada
    cantidad: float = 0.0
    unidad: str = "L"
    fecha: str = ""
    proveedor: str = ""
    num_albaran: str = ""
    num_lote: str = ""
    precio_unidad: float = 0.0
    notas: str = ""
    fecha_creacion: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "nombre_comercial": self.nombre_comercial,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
            "fecha": self.fecha,
            "proveedor": self.proveedor,
            "num_albaran": self.num_albaran,
            "num_lote": self.num_lote,
            "precio_unidad": self.precio_unidad,
            "notas": self.notas,
            "fecha_creacion": self.fecha_creacion,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'StockEntrada':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class CuadernoExplotacion:
    """Cuaderno de explotación completo de un cliente"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    nombre_explotacion: str = ""
    titular: str = ""
    nif_titular: str = ""
    domicilio: str = ""
    codigo_explotacion: str = ""  # REGA, etc.
    año: int = field(default_factory=lambda: datetime.now().year)
    parcelas: List[Parcela] = field(default_factory=list)
    productos: List[ProductoFitosanitario] = field(default_factory=list)
    tratamientos: List[Tratamiento] = field(default_factory=list)
    fertilizaciones: List['Fertilizacion'] = field(default_factory=list)
    cosechas: List['Cosecha'] = field(default_factory=list)
    asesoramientos: List['Asesoramiento'] = field(default_factory=list)
    stock_entradas: List['StockEntrada'] = field(default_factory=list)
    hojas_originales: List[HojaExcel] = field(default_factory=list)  # Hojas Excel importadas
    fecha_creacion: str = field(default_factory=lambda: datetime.now().isoformat())
    fecha_modificacion: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre_explotacion": self.nombre_explotacion,
            "titular": self.titular,
            "nif_titular": self.nif_titular,
            "domicilio": self.domicilio,
            "codigo_explotacion": self.codigo_explotacion,
            "año": self.año,
            "parcelas": [p.to_dict() for p in self.parcelas],
            "productos": [p.to_dict() for p in self.productos],
            "tratamientos": [t.to_dict() for t in self.tratamientos],
            "fertilizaciones": [f.to_dict() for f in self.fertilizaciones],
            "cosechas": [c.to_dict() for c in self.cosechas],
            "asesoramientos": [a.to_dict() for a in self.asesoramientos],
            "stock_entradas": [s.to_dict() for s in self.stock_entradas],
            "hojas_originales": [h.to_dict() for h in self.hojas_originales],
            "fecha_creacion": self.fecha_creacion,
            "fecha_modificacion": self.fecha_modificacion
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'CuadernoExplotacion':
        d = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        if 'parcelas' in d:
            d['parcelas'] = [Parcela.from_dict(p) if isinstance(p, dict) else p 
                           for p in d['parcelas']]
        if 'productos' in d:
            d['productos'] = [ProductoFitosanitario.from_dict(p) if isinstance(p, dict) else p 
                            for p in d['productos']]
        if 'tratamientos' in d:
            d['tratamientos'] = [Tratamiento.from_dict(t) if isinstance(t, dict) else t 
                               for t in d['tratamientos']]
        if 'fertilizaciones' in d:
            raw = d.get('fertilizaciones') or []
            d['fertilizaciones'] = [Fertilizacion.from_dict(f) if isinstance(f, dict) else f for f in raw]
        if 'cosechas' in d:
            raw = d.get('cosechas') or []
            d['cosechas'] = [Cosecha.from_dict(c) if isinstance(c, dict) else c for c in raw]
        if 'asesoramientos' in d:
            raw = d.get('asesoramientos') or []
            d['asesoramientos'] = [Asesoramiento.from_dict(a) if isinstance(a, dict) else a for a in raw]
        if 'stock_entradas' in d:
            raw = d.get('stock_entradas') or []
            d['stock_entradas'] = [StockEntrada.from_dict(s) if isinstance(s, dict) else s for s in raw]
        if 'hojas_originales' in d:
            d['hojas_originales'] = [HojaExcel.from_dict(h) if isinstance(h, dict) else h 
                                    for h in d['hojas_originales']]
        return cls(**d)
    
    # ============================================
    # MÉTODOS DE GESTIÓN
    # ============================================
    
    def obtener_hoja(self, sheet_id: str) -> Optional['HojaExcel']:
        """Obtiene una hoja importada por sheet_id."""
        for h in self.hojas_originales:
            if h.sheet_id == sheet_id:
                return h
        return None

    def actualizar_hoja(
        self,
        sheet_id: str,
        datos: Optional[List[List[Any]]] = None,
        columnas: Optional[List[str]] = None,
        nombre: Optional[str] = None,
    ) -> Optional['HojaExcel']:
        """Actualiza una hoja importada. Marca origen como importado_editable."""
        hoja = self.obtener_hoja(sheet_id)
        if not hoja:
            return None
        if datos is not None:
            hoja.datos = datos
        if columnas is not None:
            hoja.columnas = columnas
        if nombre is not None:
            hoja.nombre = nombre
        hoja.origen = "importado_editable"
        self._actualizar_modificacion()
        return hoja

    def aplicar_celda(
        self,
        sheet_id: str,
        row: int,
        col: int,
        value: Any,
    ) -> bool:
        """
        Edición atómica de una celda en hoja importada.
        row/col son índices 0-based. Crea filas/columnas si no existen.
        """
        hoja = self.obtener_hoja(sheet_id)
        if not hoja:
            return False
        while len(hoja.datos) <= row:
            hoja.datos.append([])
        fila = hoja.datos[row]
        while len(fila) <= col:
            fila.append("")
        fila[col] = value
        hoja.origen = "importado_editable"
        self._actualizar_modificacion()
        return True

    def obtener_fertilizacion(self, fertilizacion_id: str) -> Optional['Fertilizacion']:
        """Obtiene una fertilización por ID."""
        for f in self.fertilizaciones:
            if f.id == fertilizacion_id:
                return f
        return None

    def obtener_cosecha(self, cosecha_id: str) -> Optional['Cosecha']:
        """Obtiene una cosecha por ID."""
        for c in self.cosechas:
            if c.id == cosecha_id:
                return c
        return None

    def aplicar_celda_estructural(self, sheet_type: str, entity_id: str, column: str, value: Any) -> bool:
        """
        Edición atómica de un campo en hoja base (parcelas, productos, tratamientos, fertilizantes, cosecha).
        column = clave del campo (ej. nombre, superficie_ha).
        Para tratamientos, soporta campos de producto: nombre_comercial, numero_registro, dosis, unidad_dosis, numero_lote.
        """
        if sheet_type == "parcelas":
            ent = self.obtener_parcela(entity_id)
        elif sheet_type == "productos":
            ent = self.obtener_producto(entity_id)
        elif sheet_type == "tratamientos":
            ent = self.obtener_tratamiento(entity_id)
        elif sheet_type == "fertilizantes":
            ent = self.obtener_fertilizacion(entity_id)
        elif sheet_type == "cosecha":
            ent = self.obtener_cosecha(entity_id)
        elif sheet_type == "asesoramiento":
            ent = self.obtener_asesoramiento(entity_id)
        else:
            return False
        if not ent:
            return False

        PRODUCT_FIELDS = {"nombre_comercial", "numero_registro", "dosis", "unidad_dosis", "numero_lote"}
        if sheet_type == "tratamientos" and column in PRODUCT_FIELDS and hasattr(ent, "productos"):
            if ent.productos:
                prod = ent.productos[0]
                if column == "dosis":
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        pass
                setattr(prod, column, value)
                self._actualizar_modificacion()
                return True
            return False

        if not hasattr(ent, column):
            return False
        current = getattr(ent, column)
        if isinstance(current, (int, float)) and not isinstance(current, bool):
            try:
                value = float(value) if isinstance(current, float) else int(value)
            except (TypeError, ValueError):
                value = value
        elif isinstance(current, bool):
            value = str(value).lower() in ("1", "true", "sí", "si", "yes")
        setattr(ent, column, value)
        self._actualizar_modificacion()
        return True

    def eliminar_hoja(self, sheet_id: str) -> bool:
        """Elimina una hoja importada por sheet_id."""
        for i, h in enumerate(self.hojas_originales):
            if h.sheet_id == sheet_id:
                self.hojas_originales.pop(i)
                self._actualizar_modificacion()
                return True
        return False

    def agregar_parcela(self, parcela: Parcela) -> Parcela:
        """Añade una parcela al cuaderno"""
        self.parcelas.append(parcela)
        self._actualizar_modificacion()
        return parcela
    
    def agregar_producto(self, producto: ProductoFitosanitario) -> ProductoFitosanitario:
        """Añade un producto al inventario"""
        self.productos.append(producto)
        self._actualizar_modificacion()
        return producto
    
    def agregar_tratamiento(self, tratamiento: Tratamiento) -> Tratamiento:
        """
        Añade un tratamiento (registro único, sin desglose).
        Para el flujo normal usar agregar_tratamiento_desglosado.

        Invariante de seguridad: si la fila referencia parcelas de cultivos
        distintos, la desglosamos automáticamente en una fila por parcela para
        no mezclar cultivos (p.ej. girasol + garbanzos en una misma línea).
        """
        pids = [pid for pid in (tratamiento.parcela_ids or []) if pid]
        if len(pids) > 1:
            cultivos = set()
            for pid in pids:
                p = self.obtener_parcela(pid)
                if p:
                    c = (p.especie or p.cultivo or "").strip().upper()
                    if c:
                        cultivos.add(c)
            if len(cultivos) > 1:
                creados = self.agregar_tratamiento_desglosado(tratamiento)
                return creados[0] if creados else tratamiento

        self._sincronizar_campos_tratamiento(tratamiento)
        self._enriquecer_productos(tratamiento)
        self.tratamientos.append(tratamiento)
        self.ordenar_tratamientos()
        self._actualizar_modificacion()
        return tratamiento

    def agregar_tratamiento_desglosado(self, tratamiento: Tratamiento) -> List[Tratamiento]:
        """
        Desglosa un tratamiento en líneas individuales:
        1 línea por parcela × 1 línea por producto.
        Si tiene 3 parcelas y 2 productos → 6 registros.
        """
        parcela_ids = tratamiento.parcela_ids or []
        productos = tratamiento.productos or []

        if not parcela_ids:
            parcela_ids = [""]
        if not productos:
            productos = [ProductoAplicado()]

        creados: List[Tratamiento] = []
        for pid in parcela_ids:
            parcela = self.obtener_parcela(pid) if pid else None
            sup = float(parcela.superficie_cultivada or parcela.superficie_ha or parcela.superficie_sigpac or 0) if parcela else 0.0
            cultivo = (parcela.especie or parcela.cultivo or "").strip().upper() if parcela else ""
            nombre = parcela.nombre if parcela else ""
            orden = str(parcela.num_orden) if parcela and isinstance(parcela.num_orden, int) and parcela.num_orden > 0 else ""

            for prod in productos:
                plaga_prod = (getattr(prod, "problema_fitosanitario", "") or "").strip()
                plaga_trat = (tratamiento.problema_fitosanitario or tratamiento.plaga_enfermedad or "").strip()
                # Cada línea: problemática del producto; si vacía, la del tratamiento (cabecera del formulario)
                plaga_final = (plaga_prod or plaga_trat).strip()
                prod_copy = ProductoAplicado(
                    producto_id=prod.producto_id,
                    nombre_comercial=prod.nombre_comercial,
                    numero_registro=prod.numero_registro,
                    numero_lote=getattr(prod, "numero_lote", "") or "",
                    problema_fitosanitario=plaga_prod,
                    dosis=prod.dosis,
                    unidad_dosis=prod.unidad_dosis,
                    caldo_hectarea=prod.caldo_hectarea,
                    notas=prod.notas,
                )
                t = Tratamiento(
                    parcela_ids=[pid] if pid else [],
                    parcela_nombres=[nombre] if nombre else [],
                    num_orden_parcelas=orden,
                    cultivo_especie=cultivo or tratamiento.cultivo_especie,
                    superficie_tratada=round(sup, 2) if sup else tratamiento.superficie_tratada,
                    fecha_aplicacion=tratamiento.fecha_aplicacion,
                    problema_fitosanitario=plaga_final,
                    plaga_enfermedad=plaga_final,
                    aplicador=tratamiento.aplicador or tratamiento.operador,
                    operador=tratamiento.operador or tratamiento.aplicador,
                    equipo=tratamiento.equipo,
                    productos=[prod_copy],
                    eficacia=tratamiento.eficacia,
                    observaciones=tratamiento.observaciones,
                    justificacion=tratamiento.justificacion,
                    metodo_aplicacion=tratamiento.metodo_aplicacion,
                    condiciones_climaticas=tratamiento.condiciones_climaticas,
                    hora_inicio=tratamiento.hora_inicio,
                    hora_fin=tratamiento.hora_fin,
                    estado=tratamiento.estado,
                )
                self._enriquecer_productos(t)
                self.tratamientos.append(t)
                creados.append(t)

        self.ordenar_tratamientos()
        self._actualizar_modificacion()
        return creados

    def _enriquecer_productos(self, tratamiento: Tratamiento) -> None:
        """Snapshot de producto desde inventario si hay producto_id."""
        for prod_aplicado in tratamiento.productos:
            if prod_aplicado.producto_id:
                producto = self.obtener_producto(prod_aplicado.producto_id)
                if producto:
                    prod_aplicado.nombre_comercial = prod_aplicado.nombre_comercial or producto.nombre_comercial
                    prod_aplicado.numero_registro = prod_aplicado.numero_registro or producto.numero_registro
                    prod_aplicado.numero_lote = prod_aplicado.numero_lote or producto.numero_lote

    def ordenar_tratamientos(self) -> None:
        """Ordena por cultivo, luego Nº parcela, luego fecha (cronológico)."""
        def sort_key(t: Tratamiento):
            cultivo = (t.cultivo_especie or "").strip().lower()
            try:
                orden = int(str(t.num_orden_parcelas).split(",")[0].strip()) if t.num_orden_parcelas else 9999
            except (ValueError, IndexError):
                orden = 9999
            fecha = t.fecha_aplicacion or ""
            # id: orden estable entre filas con mismo cultivo/fecha/parcela
            return (cultivo, orden, fecha, t.id or "")
        self.tratamientos.sort(key=sort_key)

    def copiar_tratamiento_a_parcelas(self, tratamiento_id: str, parcela_ids: List[str]) -> List[Tratamiento]:
        """Copia un tratamiento existente a otras parcelas (1 línea por parcela por producto)."""
        t_orig = self.obtener_tratamiento(tratamiento_id)
        if not t_orig:
            return []
        plantilla = Tratamiento(
            parcela_ids=parcela_ids,
            fecha_aplicacion=t_orig.fecha_aplicacion,
            problema_fitosanitario=t_orig.problema_fitosanitario or t_orig.plaga_enfermedad,
            plaga_enfermedad=t_orig.plaga_enfermedad or t_orig.problema_fitosanitario,
            aplicador=t_orig.aplicador or t_orig.operador,
            operador=t_orig.operador or t_orig.aplicador,
            equipo=t_orig.equipo,
            productos=t_orig.productos,
            eficacia=t_orig.eficacia,
            observaciones=t_orig.observaciones,
            justificacion=t_orig.justificacion,
            metodo_aplicacion=t_orig.metodo_aplicacion,
            condiciones_climaticas=t_orig.condiciones_climaticas,
            hora_inicio=t_orig.hora_inicio,
            hora_fin=t_orig.hora_fin,
            estado=t_orig.estado,
        )
        return self.agregar_tratamiento_desglosado(plantilla)
    
    def obtener_parcela(self, parcela_id: str) -> Optional[Parcela]:
        """Obtiene una parcela por ID"""
        for p in self.parcelas:
            if p.id == parcela_id:
                return p
        return None
    
    def obtener_producto(self, producto_id: str) -> Optional[ProductoFitosanitario]:
        """Obtiene un producto por ID"""
        for p in self.productos:
            if p.id == producto_id:
                return p
        return None
    
    def obtener_tratamientos_parcela(self, parcela_id: str) -> List[Tratamiento]:
        """
        Obtiene todos los tratamientos de una parcela.
        Ordenados por fecha (más reciente primero).
        """
        tratamientos = [
            t for t in self.tratamientos 
            if parcela_id in t.parcela_ids
        ]
        # Ordenar por fecha descendente
        tratamientos.sort(key=lambda t: t.fecha_aplicacion, reverse=True)
        return tratamientos
    
    def obtener_historico_completo(self) -> List[Dict]:
        """
        Obtiene el histórico completo de tratamientos.
        Formato tabla para visualización.
        """
        historico = []
        for t in sorted(self.tratamientos, key=lambda x: x.fecha_aplicacion, reverse=True):
            for prod in t.productos:
                plaga_prod = (getattr(prod, "problema_fitosanitario", "") or "").strip()
                plaga_trat = (t.problema_fitosanitario or t.plaga_enfermedad or "").strip()
                historico.append({
                    "id": t.id,
                    "fecha": t.fecha_aplicacion,
                    "parcelas": ", ".join(t.parcela_nombres),
                    "producto": prod.nombre_comercial,
                    "num_registro": prod.numero_registro,
                    "num_lote": getattr(prod, "numero_lote", "") or "",
                    "dosis": f"{prod.dosis} {prod.unidad_dosis}",
                    "plaga": plaga_prod or plaga_trat,
                    "operador": t.operador,
                    "observaciones": t.observaciones,
                    "estado": t.estado.value if isinstance(t.estado, EstadoTratamiento) else t.estado
                })
        return historico
    
    def obtener_historico_completo_filtrado(
        self,
        parcela_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        product_id: Optional[str] = None,
        num_lote: Optional[str] = None,
    ) -> List[Dict]:
        """Histórico canónico desde tratamientos + líneas producto (snapshot). Filtros: parcela, fechas, producto, lote."""
        historico = self.obtener_historico_completo()
        if not parcela_id and not date_from and not date_to and not product_id and not num_lote:
            return historico
        out = []
        for row in historico:
            if parcela_id:
                t = next((t for t in self.tratamientos if t.id == row["id"]), None)
                if not t or parcela_id not in t.parcela_ids:
                    continue
            if date_from and row["fecha"] < date_from:
                continue
            if date_to and row["fecha"] > date_to:
                continue
            if product_id:
                t = next((t for t in self.tratamientos if t.id == row["id"]), None)
                if not t or not any(p.producto_id == product_id for p in t.productos):
                    continue
            if num_lote and (row.get("num_lote") or "").strip().lower() != (num_lote or "").strip().lower():
                continue
            out.append(row)
        return out
    
    def obtener_tratamiento(self, tratamiento_id: str) -> Optional[Tratamiento]:
        """Obtiene un tratamiento por ID."""
        for t in self.tratamientos:
            if t.id == tratamiento_id:
                return t
        return None
    
    def actualizar_tratamiento(self, tratamiento_id: str, **kwargs) -> Optional[Tratamiento]:
        """Actualiza campos de un tratamiento existente."""
        t = self.obtener_tratamiento(tratamiento_id)
        if not t:
            return None
        for key, value in kwargs.items():
            if hasattr(t, key):
                setattr(t, key, value)
        # Re-sincronizar parcelas y productos si cambian
        if "parcela_ids" in kwargs:
            self._sincronizar_campos_tratamiento(t)
        if "productos" in kwargs:
            for pa in t.productos:
                if pa.producto_id:
                    prod = self.obtener_producto(pa.producto_id)
                    if prod:
                        pa.nombre_comercial = prod.nombre_comercial
                        pa.numero_registro = prod.numero_registro
                        pa.numero_lote = prod.numero_lote
        self._actualizar_modificacion()
        return t

    def _sincronizar_campos_tratamiento(self, tratamiento: Tratamiento) -> None:
        """
        Rellena campos derivados del tratamiento según las parcelas seleccionadas:
        nombres, Nº de orden, cultivo/especie y superficie tratada.
        """
        parcelas_relacionadas = [p for p in self.parcelas if p.id in (tratamiento.parcela_ids or [])]
        if not parcelas_relacionadas:
            tratamiento.parcela_nombres = []
            tratamiento.num_orden_parcelas = ""
            if not tratamiento.cultivo_especie:
                tratamiento.cultivo_especie = ""
            if not tratamiento.superficie_tratada:
                tratamiento.superficie_tratada = 0.0
            return

        tratamiento.parcela_nombres = [p.nombre for p in parcelas_relacionadas if p.nombre]

        ordenes = sorted([p.num_orden for p in parcelas_relacionadas if isinstance(p.num_orden, int) and p.num_orden > 0])
        if ordenes:
            tratamiento.num_orden_parcelas = ",".join(str(n) for n in ordenes)
        else:
            # Fallback if parcels don't have num_orden yet
            fallbacks = []
            for p in parcelas_relacionadas:
                if p.nombre:
                    fallbacks.append(p.nombre.split(" ")[1] if " " in p.nombre else p.nombre)
                elif p.num_parcela:
                    fallbacks.append(f"P{p.num_poligono}-{p.num_parcela}" if p.num_poligono else str(p.num_parcela))
                else:
                    fallbacks.append("?")
            tratamiento.num_orden_parcelas = ",".join(fallbacks)[:50]

        especies = sorted({
            (p.especie or p.cultivo or "").strip().upper()
            for p in parcelas_relacionadas
            if (p.especie or p.cultivo or "").strip()
        })
        if not tratamiento.cultivo_especie:
            # Nunca dejar "MIXTO": si hay varias parcelas con cultivos distintos,
            # usamos el primero (alfabético). La invariante real (1 tratamiento = 1 cultivo)
            # se garantiza mediante reparar_tratamientos_multi_cultivo().
            if especies:
                tratamiento.cultivo_especie = especies[0]

        if not tratamiento.superficie_tratada or tratamiento.superficie_tratada <= 0:
            total_sup = sum(
                float(p.superficie_cultivada or p.superficie_ha or p.superficie_sigpac or 0)
                for p in parcelas_relacionadas
            )
            tratamiento.superficie_tratada = round(total_sup, 2)
    
    def agregar_fertilizacion(self, fertilizacion: 'Fertilizacion') -> 'Fertilizacion':
        """Añade un registro de fertilización."""
        self.fertilizaciones.append(fertilizacion)
        self._actualizar_modificacion()
        return fertilizacion

    def agregar_cosecha(self, cosecha: 'Cosecha') -> 'Cosecha':
        """Añade un registro de cosecha."""
        self.cosechas.append(cosecha)
        self._actualizar_modificacion()
        return cosecha

    def agregar_asesoramiento(self, asesoramiento: 'Asesoramiento') -> 'Asesoramiento':
        """Añade un registro de asesoramiento (Hoja 3.2)."""
        self.asesoramientos.append(asesoramiento)
        self._actualizar_modificacion()
        return asesoramiento

    def obtener_asesoramiento(self, asesoramiento_id: str) -> Optional['Asesoramiento']:
        for a in self.asesoramientos:
            if a.id == asesoramiento_id:
                return a
        return None

    def eliminar_asesoramiento(self, asesoramiento_id: str) -> bool:
        for i, a in enumerate(self.asesoramientos):
            if a.id == asesoramiento_id:
                self.asesoramientos.pop(i)
                self._actualizar_modificacion()
                return True
        return False

    # ---- Stock ----
    def agregar_stock_entrada(self, entrada: 'StockEntrada') -> 'StockEntrada':
        self.stock_entradas.append(entrada)
        # Aumentar cantidad_adquirida del producto correspondiente
        if entrada.producto_id:
            prod = self.obtener_producto(entrada.producto_id)
            if prod:
                prod.cantidad_adquirida = round(prod.cantidad_adquirida + entrada.cantidad, 4)
                if entrada.proveedor and not prod.proveedor:
                    prod.proveedor = entrada.proveedor
        self._actualizar_modificacion()
        return entrada

    def obtener_stock_entrada(self, entrada_id: str) -> Optional['StockEntrada']:
        for s in self.stock_entradas:
            if s.id == entrada_id:
                return s
        return None

    def eliminar_stock_entrada(self, entrada_id: str) -> bool:
        for i, s in enumerate(self.stock_entradas):
            if s.id == entrada_id:
                # Revertir la cantidad en el producto
                if s.producto_id:
                    prod = self.obtener_producto(s.producto_id)
                    if prod:
                        prod.cantidad_adquirida = max(0.0, round(prod.cantidad_adquirida - s.cantidad, 4))
                self.stock_entradas.pop(i)
                self._actualizar_modificacion()
                return True
        return False

    def eliminar_parcela(self, parcela_id: str) -> bool:
        """Elimina una parcela por ID (la quita de la lista)."""
        for i, p in enumerate(self.parcelas):
            if p.id == parcela_id:
                self.parcelas.pop(i)
                self._actualizar_modificacion()
                return True
        return False

    def eliminar_producto(self, producto_id: str) -> bool:
        """Elimina un producto por ID (lo quita del inventario)."""
        for i, p in enumerate(self.productos):
            if p.id == producto_id:
                self.productos.pop(i)
                self._actualizar_modificacion()
                return True
        return False

    def eliminar_tratamiento(self, tratamiento_id: str) -> bool:
        """Elimina un tratamiento por ID."""
        for i, t in enumerate(self.tratamientos):
            if t.id == tratamiento_id:
                self.tratamientos.pop(i)
                self._actualizar_modificacion()
                return True
        return False
    
    def reparar_tratamientos_multi_cultivo(self) -> int:
        """
        Invariante estructural: un tratamiento = una única parcela (y por tanto
        un único cultivo). Cualquier tratamiento existente con parcelas de cultivos
        distintos se divide en N tratamientos (uno por parcela), preservando
        fecha, productos, operador, observaciones, etc.

        También parte los tratamientos con varias parcelas aunque sean del mismo
        cultivo, para normalizar la estructura (1 línea por parcela × producto).

        Es idempotente: si ya está todo separado, no cambia nada.
        Devuelve el número de tratamientos que se han dividido.
        """
        nuevos: List[Tratamiento] = []
        reparados = 0
        cambios = False
        for t in self.tratamientos:
            pids = [pid for pid in (t.parcela_ids or []) if pid]
            if len(pids) <= 1:
                nuevos.append(t)
                continue

            parcelas = [self.obtener_parcela(pid) for pid in pids]
            parcelas_validas = [(pid, p) for pid, p in zip(pids, parcelas) if p]
            if not parcelas_validas:
                nuevos.append(t)
                continue

            cultivos = {
                (p.especie or p.cultivo or "").strip().upper()
                for _, p in parcelas_validas
                if (p.especie or p.cultivo or "").strip()
            }

            # Si todas las parcelas comparten el mismo cultivo, no rompemos
            # agrupaciones legítimas (p.ej. un tratamiento a varias parcelas de trigo).
            if len(cultivos) <= 1:
                nuevos.append(t)
                continue

            # Hay cultivos distintos → partir en una fila por parcela.
            reparados += 1
            cambios = True
            for pid, p in parcelas_validas:
                sup = float(p.superficie_cultivada or p.superficie_ha or p.superficie_sigpac or 0)
                cultivo = (p.especie or p.cultivo or "").strip().upper()
                orden = str(p.num_orden) if isinstance(p.num_orden, int) and p.num_orden > 0 else ""
                productos_copia = [
                    ProductoAplicado(
                        producto_id=prod.producto_id,
                        nombre_comercial=prod.nombre_comercial,
                        numero_registro=prod.numero_registro,
                        numero_lote=getattr(prod, "numero_lote", "") or "",
                        problema_fitosanitario=getattr(prod, "problema_fitosanitario", "") or "",
                        dosis=prod.dosis,
                        unidad_dosis=prod.unidad_dosis,
                        caldo_hectarea=prod.caldo_hectarea,
                        notas=prod.notas,
                    )
                    for prod in (t.productos or [])
                ]
                nuevo = Tratamiento(
                    parcela_ids=[pid],
                    parcela_nombres=[p.nombre] if p.nombre else [],
                    num_orden_parcelas=orden,
                    cultivo_especie=cultivo or t.cultivo_especie,
                    cultivo_variedad=t.cultivo_variedad or p.variedad,
                    superficie_tratada=round(sup, 2) if sup else t.superficie_tratada,
                    fecha_aplicacion=t.fecha_aplicacion,
                    problema_fitosanitario=t.problema_fitosanitario,
                    plaga_enfermedad=t.plaga_enfermedad,
                    aplicador=t.aplicador,
                    operador=t.operador,
                    equipo=t.equipo,
                    productos=productos_copia,
                    eficacia=t.eficacia,
                    observaciones=t.observaciones,
                    justificacion=t.justificacion,
                    metodo_aplicacion=t.metodo_aplicacion,
                    condiciones_climaticas=t.condiciones_climaticas,
                    hora_inicio=t.hora_inicio,
                    hora_fin=t.hora_fin,
                    estado=t.estado,
                    color_fila=t.color_fila,
                )
                nuevos.append(nuevo)

        if cambios:
            self.tratamientos = nuevos
            self.ordenar_tratamientos()
            self._actualizar_modificacion()
        return reparados

    def reparar_tratamientos_num_orden_multi_parcela(self) -> int:
        """
        Repara tratamientos históricos mal particionados cuando un Nº de orden
        representa varias parcelas (p. ej. recintos distintos) y solo quedó una.

        Criterio conservador:
        - tratamiento con 1 sola parcela_id
        - num_orden_parcelas con un único número (ej: "11")
        - existen >1 parcelas con ese num_orden en el cuaderno
        - faltan líneas hermanas para alguna de esas parcelas

        Devuelve el número de líneas nuevas creadas.
        """
        # Índice de parcelas por Nº orden
        orden_to_parcelas: Dict[int, List[Parcela]] = {}
        for p in self.parcelas:
            try:
                no = int(float(getattr(p, "num_orden", 0) or 0))
            except (TypeError, ValueError):
                continue
            if no > 0:
                orden_to_parcelas.setdefault(no, []).append(p)

        if not orden_to_parcelas:
            return 0

        def _parse_num_orden_unico(s: str) -> Optional[int]:
            raw = (s or "").strip()
            if not raw:
                return None
            parts = [x.strip() for x in raw.replace(";", ",").split(",") if x.strip()]
            if len(parts) != 1:
                return None
            try:
                return int(float(parts[0]))
            except (TypeError, ValueError):
                return None

        def _firma_base(t: Tratamiento) -> tuple:
            prod = t.productos[0] if t.productos else ProductoAplicado()
            return (
                t.fecha_aplicacion or "",
                (t.problema_fitosanitario or t.plaga_enfermedad or "").strip().lower(),
                (prod.nombre_comercial or "").strip().lower(),
                (prod.numero_registro or "").strip().lower(),
                float(prod.dosis or 0),
                (prod.unidad_dosis or "").strip().lower(),
                (t.aplicador or t.operador or "").strip().lower(),
                (t.equipo or "").strip().lower(),
            )

        creadas = 0
        nuevas: List[Tratamiento] = []
        existentes = list(self.tratamientos)

        for t in existentes:
            nuevas.append(t)
            if len([pid for pid in (t.parcela_ids or []) if pid]) != 1:
                continue
            orden = _parse_num_orden_unico(t.num_orden_parcelas or "")
            if not orden:
                continue
            candidatas = orden_to_parcelas.get(orden, [])
            if len(candidatas) <= 1:
                continue

            firma = _firma_base(t)
            # Parcelas ya cubiertas por líneas hermanas equivalentes
            cubiertas = set()
            for sib in existentes + nuevas:
                if _parse_num_orden_unico(sib.num_orden_parcelas or "") != orden:
                    continue
                if _firma_base(sib) != firma:
                    continue
                for pid in (sib.parcela_ids or []):
                    if pid:
                        cubiertas.add(pid)

            faltantes = [p for p in candidatas if p.id not in cubiertas]
            if not faltantes:
                continue

            prod_copia = [
                ProductoAplicado(
                    producto_id=pa.producto_id,
                    nombre_comercial=pa.nombre_comercial,
                    numero_registro=pa.numero_registro,
                    numero_lote=pa.numero_lote,
                    problema_fitosanitario=pa.problema_fitosanitario,
                    dosis=pa.dosis,
                    unidad_dosis=pa.unidad_dosis,
                    caldo_hectarea=pa.caldo_hectarea,
                    notas=pa.notas,
                )
                for pa in (t.productos or [])
            ]

            for p in faltantes:
                try:
                    sup = float(p.superficie_cultivada or p.superficie_ha or p.superficie_sigpac or 0)
                except (TypeError, ValueError):
                    sup = 0.0
                nuevo = Tratamiento(
                    parcela_ids=[p.id],
                    parcela_nombres=[p.nombre] if p.nombre else [],
                    num_orden_parcelas=str(orden),
                    cultivo_especie=(p.especie or p.cultivo or t.cultivo_especie or "").strip().upper(),
                    cultivo_variedad=t.cultivo_variedad or p.variedad,
                    superficie_tratada=round(sup, 2) if sup > 0 else t.superficie_tratada,
                    fecha_aplicacion=t.fecha_aplicacion,
                    problema_fitosanitario=t.problema_fitosanitario,
                    plaga_enfermedad=t.plaga_enfermedad,
                    aplicador=t.aplicador,
                    operador=t.operador,
                    equipo=t.equipo,
                    productos=[
                        ProductoAplicado(
                            producto_id=pa.producto_id,
                            nombre_comercial=pa.nombre_comercial,
                            numero_registro=pa.numero_registro,
                            numero_lote=pa.numero_lote,
                            problema_fitosanitario=pa.problema_fitosanitario,
                            dosis=pa.dosis,
                            unidad_dosis=pa.unidad_dosis,
                            caldo_hectarea=pa.caldo_hectarea,
                            notas=pa.notas,
                        )
                        for pa in prod_copia
                    ],
                    eficacia=t.eficacia,
                    observaciones=t.observaciones,
                    justificacion=t.justificacion,
                    metodo_aplicacion=t.metodo_aplicacion,
                    condiciones_climaticas=t.condiciones_climaticas,
                    hora_inicio=t.hora_inicio,
                    hora_fin=t.hora_fin,
                    estado=t.estado,
                    color_fila=t.color_fila,
                )
                nuevas.append(nuevo)
                creadas += 1

        if creadas > 0:
            self.tratamientos = nuevas
            self.ordenar_tratamientos()
            self._actualizar_modificacion()
        return creadas

    def normalizar_num_orden_parcelas_en_grupos(self) -> int:
        """
        Normaliza num_orden_parcelas para mostrar el bloque completo de órdenes
        relacionadas (ej: "11,8,10") en filas del mismo tratamiento lógico.

        No cambia parcela_ids; solo el string visible num_orden_parcelas.
        """
        id_to_orden: Dict[str, int] = {}
        for p in self.parcelas:
            try:
                no = int(float(getattr(p, "num_orden", 0) or 0))
            except (TypeError, ValueError):
                no = 0
            if no > 0:
                id_to_orden[p.id] = no

        def _prod_sig(t: Tratamiento) -> tuple:
            prod = t.productos[0] if t.productos else ProductoAplicado()
            return (
                (prod.nombre_comercial or "").strip().lower(),
                (prod.numero_registro or "").strip().lower(),
                float(prod.dosis or 0),
                (prod.unidad_dosis or "").strip().lower(),
            )

        groups: Dict[tuple, List[Tratamiento]] = {}
        for t in self.tratamientos:
            key = (
                t.fecha_aplicacion or "",
                (t.problema_fitosanitario or t.plaga_enfermedad or "").strip().lower(),
                (t.aplicador or t.operador or "").strip().lower(),
                (t.equipo or "").strip().lower(),
                _prod_sig(t),
            )
            groups.setdefault(key, []).append(t)

        cambios = 0
        for _, items in groups.items():
            ordenes = sorted({
                id_to_orden.get(pid, 0)
                for t in items
                for pid in (t.parcela_ids or [])
                if pid in id_to_orden
            })
            ordenes = [o for o in ordenes if o > 0]
            if len(ordenes) <= 1:
                continue
            joined = ",".join(str(o) for o in ordenes)
            for t in items:
                if (t.num_orden_parcelas or "").strip() != joined:
                    t.num_orden_parcelas = joined
                    cambios += 1

        if cambios > 0:
            self._actualizar_modificacion()
        return cambios

    def reestablecer_num_orden_individual_tratamientos(self) -> int:
        """
        Reestablece num_orden_parcelas a valor individual por fila, tomando la
        primera parcela_id relacionada con el tratamiento.
        """
        id_to_orden: Dict[str, int] = {}
        for p in self.parcelas:
            try:
                no = int(float(getattr(p, "num_orden", 0) or 0))
            except (TypeError, ValueError):
                no = 0
            if no > 0:
                id_to_orden[p.id] = no

        cambios = 0
        for t in self.tratamientos:
            pids = [pid for pid in (t.parcela_ids or []) if pid]
            if not pids:
                continue
            ordenes = [id_to_orden.get(pid, 0) for pid in pids if id_to_orden.get(pid, 0) > 0]
            if not ordenes:
                continue
            # Para filas desglosadas, dejamos el orden individual (primero).
            nuevo = str(ordenes[0])
            if (t.num_orden_parcelas or "").strip() != nuevo:
                t.num_orden_parcelas = nuevo
                cambios += 1

        if cambios > 0:
            self._actualizar_modificacion()
        return cambios

    def _actualizar_modificacion(self):
        """Actualiza fecha de modificación"""
        self.fecha_modificacion = datetime.now().isoformat()
    
    # ============================================
    # PERSISTENCIA
    # ============================================
    
    def guardar(self, filepath: str):
        """Guarda el cuaderno en un archivo JSON (flush explícito para persistencia)"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
    
    @classmethod
    def cargar(cls, filepath: str) -> 'CuadernoExplotacion':
        """Carga un cuaderno desde archivo JSON"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)


# ============================================
# CAMPOS MÍNIMOS POR TRATAMIENTO (LEGAL)
# ============================================

CAMPOS_OBLIGATORIOS_TRATAMIENTO = [
    "fecha_aplicacion",
    "parcela_ids",
    "productos",  # Debe tener al menos uno con nombre_comercial, numero_registro, dosis
]

CAMPOS_OBLIGATORIOS_PRODUCTO = [
    "nombre_comercial",
    "numero_registro",
    "numero_lote",
    "cantidad_adquirida",
]

CAMPOS_OBLIGATORIOS_PARCELA = [
    "nombre",
    "referencia_catastral",
]
