"""
routers/files.py
Endpoints del módulo "Gestión de Archivos y Carpetas" (Iteración 1).
Implementa el contrato definido en el documento consolidado, sección 2.
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pathlib import Path
from datetime import datetime, timezone
import magic
import shutil
import os
import stat as stat_module
import subprocess

from database import get_connection
from models import (
    APIResponse, ErrorDetail,
    CreateFolderRequest, CreateFolderData,
    CreateFileRequest, CreateFileData, DetectedType,
    RenameRequest, RenameData,
    DeleteData,
    MoveRequest, MoveData,
    ConvertRequest, ConvertData,
    FileListItem, ListFolderData,
)

# Carpeta de papelera propia de la app, dentro de AppData del usuario actual.
# Se resuelve en tiempo de ejecución (nunca se escribe la ruta a mano).
TRASH_DIR = Path(os.getenv("APPDATA")) / "MONARK" / "Papelera"

# Mapa simple de mime-type -> (categoría, extensión sugerida)
# Se irá ampliando a medida que aparezcan más tipos en uso real.
# 'suggested_extension' es solo informativo para el frontend (ej. mostrar un ícono
# apropiado) — nunca se usa para renombrar el archivo ni afecta su comportamiento.
TYPE_MAP = {
    "text/plain": ("document", ".txt"),
    "text/markdown": ("document", ".md"),
    "application/json": ("document", ".json"),
    "application/pdf": ("document", ".pdf"),
    "image/png": ("image", ".png"),
    "image/jpeg": ("image", ".jpg"),
    "image/webp": ("image", ".webp"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ("document", ".docx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ("document", ".xlsx"),
}

router = APIRouter(prefix="/api/v1/files", tags=["Archivos"])

# Caracteres no permitidos en nombres de archivo/carpeta en Windows
INVALID_CHARS = set('\\/:*?"<>|')


# ---------------------------------------------------------------------------
# Funciones de apoyo (lógica transversal, sección 6 del contrato)
# ---------------------------------------------------------------------------

def now_iso() -> str:
    """Fecha/hora actual en formato ISO 8601, igual que en todos los ejemplos del contrato."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_valid_name(name: str) -> bool:
    """Revisa que el nombre no tenga caracteres prohibidos en Windows ni esté vacío."""
    if not name or not name.strip():
        return False
    return not any(char in INVALID_CHARS for char in name)


def is_protected(path: str) -> bool:
    """
    Consulta la tabla protected_paths para saber si la ruta dada cae dentro
    de una ruta protegida del sistema (sección 6 del contrato).
    Se normaliza a minúsculas y con '/' para comparar sin importar
    mayúsculas ni el tipo de separador que use el usuario.
    """
    normalized = str(Path(path)).replace("\\", "/").lower()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT path FROM protected_paths")
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        protected = row["path"].replace("\\", "/").lower()
        if normalized.startswith(protected):
            return True
    return False


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    """Arma una respuesta de error siguiendo exactamente el formato del contrato."""
    body = APIResponse(success=False, data=None, error=ErrorDetail(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def detect_type(file_path: Path) -> DetectedType | None:
    """
    Detecta el tipo real del archivo analizando su contenido (magic bytes),
    no su nombre. Si el archivo está vacío, no hay nada que analizar todavía,
    así que se devuelve None (tal como quedó definido en el contrato).
    """
    if file_path.stat().st_size == 0:
        return None

    mime = magic.from_file(str(file_path), mime=True)
    category, suggested_extension = TYPE_MAP.get(mime, ("unknown", None))
    return DetectedType(mime=mime, category=category, suggested_extension=suggested_extension)


def is_reparse_point(path: Path) -> bool:
    """Detecta puntos de unión (junctions) de Windows, para no entrar en bucle al recorrerlos."""
    try:
        attrs = path.stat().st_file_attributes
        return bool(attrs & stat_module.FILE_ATTRIBUTE_REPARSE_POINT)
    except (OSError, AttributeError):
        return False


def folder_size(path: Path) -> int:
    """Suma recursiva del tamaño de una carpeta, saltando symlinks/junctions para evitar bucles infinitos."""
    if not path.exists():
        return 0
    total = 0
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    entry_path = Path(entry.path)
                    if entry.is_symlink() or is_reparse_point(entry_path):
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        total += folder_size(entry_path)
                    elif entry.is_file(follow_symlinks=False):
                        total += entry.stat().st_size
                except (OSError, PermissionError):
                    continue
    except (PermissionError, OSError):
        pass
    return total


# ---------------------------------------------------------------------------
# 2.1 — Crear carpeta
# ---------------------------------------------------------------------------

@router.post("/folders", summary="Crear carpeta")
def create_folder(payload: CreateFolderRequest):
    parent_path = Path(payload.path)
    new_folder_path = parent_path / payload.name

    # 1. Validar que la ruta padre exista
    if not parent_path.exists() or not parent_path.is_dir():
        return error_response(400, "INVALID_PATH", "La ruta padre no existe.")

    # 2. Validar nombre
    if not is_valid_name(payload.name):
        return error_response(400, "INVALID_NAME", "El nombre contiene caracteres no permitidos.")

    # 3. Validar rutas protegidas
    if is_protected(str(new_folder_path)):
        return error_response(403, "PROTECTED_PATH", "Esta ubicación está protegida por el sistema.")

    # 4. Validar que no exista ya
    if new_folder_path.exists():
        return error_response(400, "FOLDER_ALREADY_EXISTS", "Ya existe una carpeta con ese nombre en esta ubicación.")

    # 5. Crear la carpeta
    try:
        new_folder_path.mkdir(parents=False, exist_ok=False)
    except PermissionError:
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para crear la carpeta.")
    except OSError as e:
        return error_response(500, "FOLDER_CREATE_FAILED", f"No se pudo crear la carpeta: {e}")

    # 6. Responder éxito, exactamente en el formato del contrato
    data = CreateFolderData(
        full_path=str(new_folder_path),
        name=payload.name,
        created_at=now_iso()
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=201, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.2 — Crear archivo
# ---------------------------------------------------------------------------

@router.post("/files", summary="Crear archivo")
def create_file(payload: CreateFileRequest):
    parent_path = Path(payload.path)
    new_file_path = parent_path / payload.name

    # 1. Validar que la ruta padre exista
    if not parent_path.exists() or not parent_path.is_dir():
        return error_response(400, "INVALID_PATH", "La ruta padre no existe.")

    # 2. Validar nombre (recuerda: la extensión es opcional, no se exige)
    if not is_valid_name(payload.name):
        return error_response(400, "INVALID_NAME", "El nombre contiene caracteres no permitidos.")

    # 3. Validar rutas protegidas
    if is_protected(str(new_file_path)):
        return error_response(403, "PROTECTED_PATH", "Esta ubicación está protegida por el sistema.")

    # 4. Validar que no exista ya
    if new_file_path.exists():
        return error_response(400, "FILE_ALREADY_EXISTS", "Ya existe un archivo con ese nombre en esta ubicación.")

    # 5. Crear el archivo con el contenido inicial (vacío por defecto)
    try:
        new_file_path.write_text(payload.content, encoding="utf-8")
    except PermissionError:
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para crear el archivo.")
    except OSError as e:
        return error_response(500, "FILE_CREATE_FAILED", f"No se pudo crear el archivo: {e}")

    # 6. Detectar tipo por contenido (None si quedó vacío)
    detected = detect_type(new_file_path)

    # 7. Responder éxito
    data = CreateFileData(
        full_path=str(new_file_path),
        name=payload.name,
        detected_type=detected,
        size_bytes=new_file_path.stat().st_size,
        created_at=now_iso()
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=201, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.3 — Renombrar carpeta/archivo
# ---------------------------------------------------------------------------

@router.patch("/rename", summary="Renombrar carpeta/archivo")
def rename_item(payload: RenameRequest):
    current_path = Path(payload.current_path)

    # 1. Validar que el elemento exista
    if not current_path.exists():
        return error_response(404, "PATH_NOT_FOUND", "El archivo o carpeta ya no existe.")

    # 2. Validar el nuevo nombre
    if not is_valid_name(payload.new_name):
        return error_response(400, "INVALID_NAME", "El nombre contiene caracteres no permitidos.")

    # 3. Validar rutas protegidas
    if is_protected(str(current_path)):
        return error_response(403, "PROTECTED_PATH", "Esta ubicación está protegida por el sistema.")

    new_path = current_path.parent / payload.new_name

    # 4. Validar que no exista ya otro elemento con ese nombre
    if new_path.exists():
        return error_response(400, "NAME_ALREADY_EXISTS", "Ya existe un archivo o carpeta con ese nombre en esta ubicación.")

    item_type = "folder" if current_path.is_dir() else "file"

    # 5. Renombrar
    try:
        current_path.rename(new_path)
    except PermissionError as e:
        if getattr(e, "winerror", None) == 32:
            return error_response(423, "FILE_IN_USE", "El archivo está siendo usado por otro proceso.")
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para renombrar.")
    except OSError as e:
        return error_response(500, "RENAME_FAILED", f"No se pudo renombrar: {e}")

    # 6. Responder éxito
    data = RenameData(
        old_path=str(current_path),
        new_path=str(new_path),
        type=item_type,
        renamed_at=now_iso()
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.4 — Eliminar carpeta/archivo (papelera propia)
# ---------------------------------------------------------------------------

@router.delete("", summary="Eliminar carpeta/archivo (a la papelera propia)")
def delete_item(path: str = Query(..., description="Ruta completa del archivo o carpeta a eliminar")):
    target = Path(path)

    # 1. Validar que exista
    if not target.exists():
        return error_response(404, "PATH_NOT_FOUND", "El archivo o carpeta ya no existe.")

    # 2. Validar rutas protegidas
    if is_protected(str(target)):
        return error_response(403, "PROTECTED_PATH", "Esta ubicación está protegida por el sistema.")

    item_type = "folder" if target.is_dir() else "file"
    size_bytes = folder_size(target) if item_type == "folder" else target.stat().st_size

    # 3. Preparar la carpeta de papelera (se crea sola la primera vez)
    TRASH_DIR.mkdir(parents=True, exist_ok=True)

    # 4. Nombre único dentro de la papelera (evita choques si borras algo con el mismo nombre dos veces)
    timestamp_suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    trash_path = TRASH_DIR / f"{target.name}_{timestamp_suffix}"

    # 5. Mover a la papelera (recursivo automático si es carpeta, gratis con shutil.move)
    try:
        shutil.move(str(target), str(trash_path))
    except PermissionError as e:
        if getattr(e, "winerror", None) == 32:
            return error_response(423, "FILE_IN_USE", "El archivo está siendo usado por otro proceso.")
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para eliminar.")
    except OSError as e:
        return error_response(500, "DELETE_FAILED", f"No se pudo eliminar: {e}")

    # 6. Registrar en la tabla trash_items
    deleted_at = now_iso()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO trash_items (original_path, trash_path, name, type, size_bytes, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (str(target), str(trash_path), target.name, item_type, size_bytes, deleted_at)
    )
    conn.commit()
    conn.close()

    # 7. Responder éxito
    data = DeleteData(
        original_path=str(target),
        trash_path=str(trash_path),
        type=item_type,
        deleted_at=deleted_at
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.5 — Mover carpeta/archivo
# ---------------------------------------------------------------------------

@router.patch("/move", summary="Mover carpeta/archivo")
def move_item(payload: MoveRequest):
    current_path = Path(payload.current_path)
    destination_path = Path(payload.destination_path)

    # 1. Validar que el elemento a mover exista
    if not current_path.exists():
        return error_response(404, "PATH_NOT_FOUND", "El archivo o carpeta a mover ya no existe.")

    # 2. Validar que el destino exista y sea una carpeta
    if not destination_path.exists():
        return error_response(400, "DESTINATION_NOT_FOUND", "La carpeta destino no existe.")
    if not destination_path.is_dir():
        return error_response(400, "DESTINATION_NOT_A_FOLDER", "El destino indicado no es una carpeta.")

    # 3. Validar rutas protegidas (origen y destino)
    if is_protected(str(current_path)) or is_protected(str(destination_path)):
        return error_response(403, "PROTECTED_PATH", "Esta operación involucra una ubicación protegida por el sistema.")

    # 4. Caso especial: mover una carpeta dentro de sí misma o de una subcarpeta propia
    if current_path.is_dir():
        same_or_inside = destination_path == current_path
        try:
            destination_path.relative_to(current_path)
            same_or_inside = True
        except ValueError:
            pass
        if same_or_inside:
            return error_response(400, "MOVE_INTO_ITSELF", "No se puede mover una carpeta dentro de sí misma.")

    new_path = destination_path / current_path.name

    # 5. Validar conflicto de nombre en destino
    if new_path.exists():
        if not payload.overwrite:
            return error_response(400, "NAME_ALREADY_EXISTS", "Ya existe un elemento con ese nombre en la carpeta destino.")
        # overwrite=True: se elimina lo existente en destino antes de mover
        try:
            if new_path.is_dir():
                shutil.rmtree(new_path)
            else:
                new_path.unlink()
        except OSError as e:
            return error_response(500, "OVERWRITE_FAILED", f"No se pudo sobrescribir el elemento existente: {e}")

    item_type = "folder" if current_path.is_dir() else "file"

    # 6. Mover
    try:
        shutil.move(str(current_path), str(new_path))
    except PermissionError as e:
        if getattr(e, "winerror", None) == 32:
            return error_response(423, "FILE_IN_USE", "El archivo está siendo usado por otro proceso.")
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para mover.")
    except OSError as e:
        return error_response(500, "MOVE_FAILED", f"No se pudo mover: {e}")

    # 7. Responder éxito
    data = MoveData(
        old_path=str(current_path),
        new_path=str(new_path),
        type=item_type,
        moved_at=now_iso()
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.6 — Convertir archivo (Nivel 1 y Nivel 2, alcance acotado de Iteración 1)
# ---------------------------------------------------------------------------

def build_unique_name(base: str, parent: Path) -> str:
    """Genera nombre_converted, y si ya existe, nombre_converted_2, _3, etc."""
    candidate = f"{base}_converted"
    counter = 2
    while (parent / candidate).exists():
        candidate = f"{base}_converted_{counter}"
        counter += 1
    return candidate


@router.post("/convert", summary="Convertir archivo")
def convert_item(payload: ConvertRequest):
    source = Path(payload.current_path)

    # 1. Validar que el origen exista y sea un archivo
    if not source.exists() or not source.is_file():
        return error_response(404, "SOURCE_NOT_FOUND", "El archivo origen no existe.")

    # 2. Validar rutas protegidas
    if is_protected(str(source)):
        return error_response(403, "PROTECTED_PATH", "Esta ubicación está protegida por el sistema.")

    source_mime = magic.from_file(str(source), mime=True)
    target = payload.target_type

    # 3. Resolver nombre de salida (siempre se crea un archivo nuevo, nunca se reemplaza el original)
    if payload.new_name:
        if not is_valid_name(payload.new_name):
            return error_response(400, "INVALID_NAME", "El nombre contiene caracteres no permitidos.")
        out_name = payload.new_name
    else:
        out_name = build_unique_name(source.stem or source.name, source.parent)

    out_path = source.parent / out_name
    if out_path.exists():
        return error_response(400, "NAME_ALREADY_EXISTS", "Ya existe un archivo con ese nombre en esta ubicación.")

    new_mime = None

    try:
        # --- Nivel 1: TXT <-> Markdown (mismo contenido, distinta interpretación) ---
        if target == "markdown" and source_mime == "text/plain":
            out_path.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            new_mime = "text/markdown"

        elif target == "text_plain" and source_mime in ("text/plain", "text/markdown"):
            out_path.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            new_mime = "text/plain"

        # --- Nivel 2: imágenes PNG <-> JPG <-> WEBP (vía Pillow) ---
        elif target in ("png", "jpg", "webp") and source_mime in ("image/png", "image/jpeg", "image/webp"):
            from PIL import Image
            img = Image.open(source)
            fmt_map = {"png": "PNG", "jpg": "JPEG", "webp": "WEBP"}
            if target == "jpg" and img.mode in ("RGBA", "P"):
                img = img.convert("RGB")  # JPEG no soporta transparencia
            img.save(out_path, fmt_map[target])
            new_mime = "image/jpeg" if target == "jpg" else f"image/{target}"

        # --- Nivel 2: TXT -> PDF (vía reportlab, sin dependencias externas) ---
        elif target == "pdf" and source_mime == "text/plain":
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
            c = canvas.Canvas(str(out_path), pagesize=letter)
            y = 750
            for line in source.read_text(encoding="utf-8").splitlines():
                c.drawString(40, y, line[:100])
                y -= 14
                if y < 40:
                    c.showPage()
                    y = 750
            c.save()
            new_mime = "application/pdf"

        # --- Nivel 2: DOCX -> PDF (vía Pandoc, requiere instalación aparte del sistema) ---
        elif target == "pdf" and source_mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            result = subprocess.run(
                ["pandoc", str(source), "-o", str(out_path)],
                capture_output=True
            )
            if result.returncode != 0:
                return error_response(
                    500, "CONVERSION_FAILED",
                    "No se pudo convertir con Pandoc. Verifica que esté instalado en el sistema."
                )
            new_mime = "application/pdf"

        else:
            return error_response(
                400, "UNSUPPORTED_CONVERSION",
                f"La conversión de '{source_mime}' a '{target}' no está soportada en esta iteración."
            )

    except FileNotFoundError:
        # Ocurre si 'pandoc' no está instalado en el sistema (no encontró el ejecutable)
        return error_response(500, "CONVERSION_FAILED", "Pandoc no está instalado en el sistema.")
    except Exception as e:
        return error_response(500, "CONVERSION_FAILED", f"No se pudo convertir el archivo: {e}")

    # 4. Responder éxito
    data = ConvertData(
        original_path=str(source),
        converted_path=str(out_path),
        original_type=source_mime,
        new_type=new_mime,
        converted_at=now_iso()
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.7 — Listar contenido de una carpeta
# ---------------------------------------------------------------------------

@router.get("/list", summary="Listar contenido de una carpeta")
def list_folder(path: str = Query(..., description="Ruta de la carpeta a listar")):
    target = Path(path)

    # 1. Validar que exista y sea carpeta
    if not target.exists():
        return error_response(404, "PATH_NOT_FOUND", "La ruta no existe.")
    if not target.is_dir():
        return error_response(400, "NOT_A_FOLDER", "La ruta indicada no es una carpeta.")

    try:
        entries = list(target.iterdir())
    except PermissionError:
        return error_response(403, "PERMISSION_DENIED", "Sin permisos para leer esta carpeta.")

    items = []
    for entry in entries:
        try:
            stat = entry.stat()
            modified_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            protected = is_protected(str(entry))

            if entry.is_dir():
                # Cálculo inmediato, sin caché (Opción A, decidida para Iteración 1)
                size = folder_size(entry)
                try:
                    item_count = sum(1 for _ in entry.iterdir())
                except PermissionError:
                    item_count = 0
                items.append(FileListItem(
                    name=entry.name, type="folder", size_bytes=size,
                    item_count=item_count, detected_type=None,
                    modified_at=modified_at, is_protected=protected
                ))
            else:
                detected = detect_type(entry)
                items.append(FileListItem(
                    name=entry.name, type="file", size_bytes=stat.st_size,
                    item_count=None, detected_type=detected,
                    modified_at=modified_at, is_protected=protected
                ))
        except (PermissionError, OSError):
            # Elemento puntual inaccesible (ej. archivo bloqueado por otro proceso): se omite, no rompe el listado completo
            continue

    data = ListFolderData(
        current_path=str(target),
        total_items=len(items),
        items=items
    )
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# Papelera — SOLO LECTURA en Iteración 1.
# Restaurar (POST /trash/restore) y purgar (DELETE /trash/purge) quedan
# explícitamente para Iteración 2, tal como se definió en el contrato.
# Este endpoint adelantado es el mínimo necesario para que la pantalla de
# Papelera pueda mostrar qué hay ahí, sin poder todavía actuar sobre ello.
# ---------------------------------------------------------------------------

@router.get("/trash", summary="Ver contenido de la papelera (solo lectura)")
def list_trash():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trash_items ORDER BY deleted_at DESC")
    rows = cursor.fetchall()
    conn.close()

    items = [
        {
            "id": row["id"],
            "original_path": row["original_path"],
            "trash_path": row["trash_path"],
            "name": row["name"],
            "type": row["type"],
            "size_bytes": row["size_bytes"],
            "deleted_at": row["deleted_at"],
        }
        for row in rows
    ]

    data = {"total_items": len(items), "items": items}
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())