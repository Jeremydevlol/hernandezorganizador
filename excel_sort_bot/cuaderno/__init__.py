"""
Cuaderno de Explotación Agrícola Digital
Módulo principal para gestión de tratamientos fitosanitarios.
"""
from .models import (
    Parcela,
    ProductoFitosanitario,
    ProductoAplicado,
    Tratamiento,
    CuadernoExplotacion,
    EstadoTratamiento,
    TipoProducto,
    CAMPOS_OBLIGATORIOS_TRATAMIENTO,
    CAMPOS_OBLIGATORIOS_PRODUCTO,
    CAMPOS_OBLIGATORIOS_PARCELA
)

__version__ = "1.0.0"
__all__ = [
    "Parcela",
    "ProductoFitosanitario", 
    "ProductoAplicado",
    "Tratamiento",
    "CuadernoExplotacion",
    "EstadoTratamiento",
    "TipoProducto",
    "CAMPOS_OBLIGATORIOS_TRATAMIENTO",
    "CAMPOS_OBLIGATORIOS_PRODUCTO",
    "CAMPOS_OBLIGATORIOS_PARCELA"
]
