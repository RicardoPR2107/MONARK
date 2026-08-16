"""
models.py
Esquemas Pydantic — definen la forma exacta de los datos que entran (request)
y salen (response) de cada endpoint. FastAPI los usa automáticamente para:
  1) Validar lo que llega (si falta un campo obligatorio, rechaza la petición
     antes de que tu código siquiera se ejecute).
  2) Generar la documentación de Swagger de forma automática.
  3) Convertir objetos Python a JSON de salida.

Por ahora solo el módulo de Archivos (Endpoints 2.1 a 2.9 del contrato).
Se irán agregando más modelos a medida que programemos Hardware, Procesos y Red.
"""

from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# Envoltorio genérico de respuesta — TODOS los endpoints devuelven este formato
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: str
    message: str


class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[ErrorDetail] = None
    timestamp: str = None

    def __init__(self, **data):
        if data.get("timestamp") is None:
            data["timestamp"] = datetime.utcnow().isoformat() + "Z"
        super().__init__(**data)


# ---------------------------------------------------------------------------
# 2.1 — Crear carpeta
# ---------------------------------------------------------------------------

class CreateFolderRequest(BaseModel):
    path: str
    name: str


class CreateFolderData(BaseModel):
    full_path: str
    name: str
    created_at: str


# ---------------------------------------------------------------------------
# 2.2 — Crear archivo
# ---------------------------------------------------------------------------

class CreateFileRequest(BaseModel):
    path: str
    name: str
    content: str = ""


class DetectedType(BaseModel):
    mime: str
    category: str
    suggested_extension: Optional[str] = None


class CreateFileData(BaseModel):
    full_path: str
    name: str
    detected_type: Optional[DetectedType] = None
    size_bytes: int
    created_at: str


# ---------------------------------------------------------------------------
# 2.3 — Renombrar carpeta/archivo
# ---------------------------------------------------------------------------

class RenameRequest(BaseModel):
    current_path: str
    new_name: str


class RenameData(BaseModel):
    old_path: str
    new_path: str
    type: str  # "file" | "folder"
    renamed_at: str


# ---------------------------------------------------------------------------
# 2.4 — Eliminar carpeta/archivo (papelera propia)
# ---------------------------------------------------------------------------

class DeleteData(BaseModel):
    original_path: str
    trash_path: str
    type: str
    deleted_at: str


# ---------------------------------------------------------------------------
# 2.5 — Mover carpeta/archivo
# ---------------------------------------------------------------------------

class MoveRequest(BaseModel):
    current_path: str
    destination_path: str
    overwrite: bool = False


class MoveData(BaseModel):
    old_path: str
    new_path: str
    type: str
    moved_at: str


# ---------------------------------------------------------------------------
# 2.6 — Convertir archivo
# ---------------------------------------------------------------------------

class ConvertRequest(BaseModel):
    current_path: str
    target_type: str
    new_name: Optional[str] = None


class ConvertData(BaseModel):
    original_path: str
    converted_path: str
    original_type: str
    new_type: str
    converted_at: str


# ---------------------------------------------------------------------------
# 2.7 — Listar contenido de una carpeta
# ---------------------------------------------------------------------------

class FileListItem(BaseModel):
    name: str
    type: str  # "file" | "folder"
    size_bytes: Optional[int] = None
    item_count: Optional[int] = None  # solo para carpetas
    detected_type: Optional[DetectedType] = None  # solo para archivos
    modified_at: str
    is_protected: bool = False


class ListFolderData(BaseModel):
    current_path: str
    total_items: int
    items: list[FileListItem]


# ---------------------------------------------------------------------------
# 2.8 — Analizador de espacio en disco
# ---------------------------------------------------------------------------

class DiskBreakdownCategory(BaseModel):
    bytes: int
    label: str
    protected: bool = False
    cleanable: bool = False


class DiskAnalysisData(BaseModel):
    drive: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    used_percentage: float
    breakdown: dict[str, DiskBreakdownCategory]
    analyzed_at: str


# ---------------------------------------------------------------------------
# 2.9 — Listar unidades/discos disponibles
# ---------------------------------------------------------------------------

class DriveInfo(BaseModel):
    letter: str
    label: str
    total_bytes: int
    filesystem: str


class DiskListData(BaseModel):
    drives: list[DriveInfo]