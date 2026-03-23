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
            "color_fila": self.color_fila or ""
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
    num_albaran: str = ""
    riqueza_npk: str = ""               # N/P/K (ej: "20-10-10")
    dosis: str = ""
    tipo_fertilizacion: str = ""
    observaciones: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "fecha_inicio": self.fecha_inicio,
            "fecha_fin": self.fecha_fin,
            "num_orden_parcelas": self.num_orden_parcelas,
            "cultivo_especie": self.cultivo_especie,
            "cultivo_variedad": self.cultivo_variedad,
            "tipo_abono": self.tipo_abono,
            "num_albaran": self.num_albaran,
            "riqueza_npk": self.riqueza_npk,
            "dosis": self.dosis,
            "tipo_fertilizacion": self.tipo_fertilizacion,
            "observaciones": self.observaciones,
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
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Cosecha':
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
        """
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
                plaga_prod = getattr(prod, "problema_fitosanitario", "") or ""
                plaga_trat = tratamiento.problema_fitosanitario or tratamiento.plaga_enfermedad
                # Con varios productos: cada uno usa su plaga; no heredar de tratamiento
                plaga_final = (plaga_prod or (plaga_trat if len(productos) == 1 else "")).strip()
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
        """Ordena tratamientos por parcela (num_orden) y luego por fecha."""
        def sort_key(t: Tratamiento):
            try:
                orden = int(t.num_orden_parcelas.split(",")[0]) if t.num_orden_parcelas else 9999
            except (ValueError, IndexError):
                orden = 9999
            fecha = t.fecha_aplicacion or "9999-99-99"
            return (orden, fecha)
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
                historico.append({
                    "id": t.id,
                    "fecha": t.fecha_aplicacion,
                    "parcelas": ", ".join(t.parcela_nombres),
                    "producto": prod.nombre_comercial,
                    "num_registro": prod.numero_registro,
                    "num_lote": getattr(prod, "numero_lote", "") or "",
                    "dosis": f"{prod.dosis} {prod.unidad_dosis}",
                    "plaga": t.plaga_enfermedad,
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
            if len(especies) == 1:
                tratamiento.cultivo_especie = especies[0]
            elif len(especies) > 1:
                tratamiento.cultivo_especie = "MIXTO"

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
