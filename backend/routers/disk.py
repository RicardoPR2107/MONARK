"""
routers/disk.py
Endpoints de disco (Analizador de espacio + listado de unidades),
sección 2.8-2.9 del contrato. Prefijo distinto a files.py: /api/v1/disk.
"""

from fastapi import APIRouter, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from pathlib import Path
import psutil
import shutil
import os
import stat as stat_module
import json

from database import get_connection
from models import APIResponse, DriveInfo, DiskListData, DiskAnalysisData, DiskBreakdownCategory
from routers.files import TRASH_DIR, now_iso, error_response

router = APIRouter(prefix="/api/v1/disk", tags=["Disco"])


def is_reparse_point(path: Path) -> bool:
    """
    Detecta 'puntos de unión' (junctions) de Windows — carpetas que en realidad
    son atajos hacia otra ubicación (ej. 'Documents and Settings' -> 'Users').
    Sin este chequeo, un recorrido recursivo puede quedar en bucle casi infinito
    entrando una y otra vez al mismo contenido por rutas distintas.
    """
    try:
        attrs = path.stat().st_file_attributes
        return bool(attrs & stat_module.FILE_ATTRIBUTE_REPARSE_POINT)
    except (OSError, AttributeError):
        return False


def folder_size_safe(path: Path) -> int:
    """
    Suma recursiva del tamaño de una carpeta, saltando symlinks y junctions
    para evitar bucles infinitos. Reemplaza el uso de rglob() por scandir()
    con control manual de recursión, más seguro para carpetas del sistema.
    """
    if not path.exists():
        return 0
    total = 0
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    entry_path = Path(entry.path)
                    if entry.is_symlink() or is_reparse_point(entry_path):
                        continue  # se salta: es un atajo, no contenido real
                    if entry.is_dir(follow_symlinks=False):
                        total += folder_size_safe(entry_path)
                    elif entry.is_file(follow_symlinks=False):
                        total += entry.stat().st_size
                except (OSError, PermissionError):
                    continue
    except (PermissionError, OSError):
        pass
    return total


def compute_breakdown(drive: str, used_bytes: int) -> dict:
    """
    Clasificación aproximada del espacio usado por categoría.
    Solo el disco del sistema (normalmente C:) tiene carpetas de Windows/Programas/Temp;
    en otros discos, todo el espacio usado se cuenta como 'archivos de usuario'.
    """
    is_system_drive = drive.upper().startswith("C")

    if is_system_drive:
        windows_size = folder_size_safe(Path("C:/Windows"))
        apps_size = folder_size_safe(Path("C:/Program Files")) + folder_size_safe(Path("C:/Program Files (x86)"))
        temp_size = folder_size_safe(Path(__import__("os").getenv("TEMP", "C:/Windows/Temp")))
        trash_size = folder_size_safe(TRASH_DIR)
        accounted = windows_size + apps_size + temp_size + trash_size
        user_files_size = max(used_bytes - accounted, 0)

        return {
            "system": {"bytes": windows_size, "label": "Sistema operativo", "protected": True, "cleanable": False},
            "applications": {"bytes": apps_size, "label": "Aplicaciones instaladas", "protected": False, "cleanable": False},
            "user_files": {"bytes": user_files_size, "label": "Archivos de usuario", "protected": False, "cleanable": False},
            "temp_cache": {"bytes": temp_size, "label": "Temporales y caché", "protected": False, "cleanable": True},
            "trash": {"bytes": trash_size, "label": "Papelera propia", "protected": False, "cleanable": True},
        }
    else:
        return {
            "system": {"bytes": 0, "label": "Sistema operativo", "protected": True, "cleanable": False},
            "applications": {"bytes": 0, "label": "Aplicaciones instaladas", "protected": False, "cleanable": False},
            "user_files": {"bytes": used_bytes, "label": "Archivos de usuario", "protected": False, "cleanable": False},
            "temp_cache": {"bytes": 0, "label": "Temporales y caché", "protected": False, "cleanable": True},
            "trash": {"bytes": 0, "label": "Papelera propia", "protected": False, "cleanable": True},
        }


# ---------------------------------------------------------------------------
# 2.9 — Listar unidades/discos disponibles
# ---------------------------------------------------------------------------

@router.get("/list", summary="Listar unidades/discos disponibles")
def list_drives():
    """
    Detección 100% automática vía psutil — cualquier disco/partición nuevo
    que agregues a futuro (ej. un SSD adicional) aparece solo, sin tocar código.
    """
    drives = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = shutil.disk_usage(part.mountpoint)
        except OSError:
            # Unidad no lista (ej. lector de DVD vacío): se omite, no rompe el listado
            continue

        letter = part.device.rstrip("\\")  # "C:\\" -> "C:"
        drives.append(DriveInfo(
            letter=letter,
            label=part.mountpoint,
            total_bytes=usage.total,
            filesystem=part.fstype
        ))

    data = DiskListData(drives=drives)
    body = APIResponse(success=True, data=data.model_dump())
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 2.8 — Analizador de espacio en disco
# ---------------------------------------------------------------------------

# Registro simple en memoria de qué unidades están siendo analizadas ahora mismo,
# para no lanzar dos análisis duplicados si el usuario pide refresh dos veces seguidas.
RUNNING_ANALYSIS: set[str] = set()


def fetch_cached_row(drive: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM disk_analysis WHERE drive = ? ORDER BY analyzed_at DESC LIMIT 1",
        (drive,)
    )
    row = cursor.fetchone()
    conn.close()
    return row


def row_to_response(row, status: str = "ready") -> JSONResponse:
    breakdown_raw = json.loads(row["breakdown_json"])
    data = DiskAnalysisData(
        drive=row["drive"],
        total_bytes=row["total_bytes"],
        used_bytes=row["used_bytes"],
        free_bytes=row["free_bytes"],
        used_percentage=row["used_percentage"],
        breakdown={k: DiskBreakdownCategory(**v) for k, v in breakdown_raw.items()},
        analyzed_at=row["analyzed_at"]
    )
    payload = data.model_dump()
    payload["status"] = status  # "ready" o "stale_refreshing" (datos viejos, recalculando en segundo plano)
    body = APIResponse(success=True, data=payload)
    return JSONResponse(status_code=200, content=body.model_dump())


def run_full_analysis_and_save(drive: str):
    """
    Se ejecuta en segundo plano (no bloquea la respuesta HTTP).
    Al terminar, guarda el resultado en disk_analysis — la próxima vez que
    el frontend consulte (sin refresh), va a encontrar este resultado nuevo.
    """
    try:
        usage = shutil.disk_usage(drive)
        used_percentage = round((usage.used / usage.total) * 100, 1)
        breakdown_raw = compute_breakdown(drive, usage.used)
        analyzed_at = now_iso()

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO disk_analysis (drive, total_bytes, used_bytes, free_bytes, used_percentage, breakdown_json, analyzed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (drive, usage.total, usage.used, usage.free, used_percentage, json.dumps(breakdown_raw), analyzed_at)
        )
        conn.commit()
        conn.close()
    finally:
        RUNNING_ANALYSIS.discard(drive)


@router.get("/analysis", summary="Analizador de espacio en disco")
def disk_analysis(
    background_tasks: BackgroundTasks,
    drive: str = Query("C:", description="Unidad a analizar, ej. C:"),
    refresh: bool = Query(False, description="Forzar recálculo en vez de usar el caché guardado (botón 'Actualizar análisis')")
):
    cached_row = fetch_cached_row(drive)

    # 1. Hay caché y no se pidió refresh: respuesta instantánea, tal cual definimos
    if cached_row and not refresh:
        return row_to_response(cached_row, status="ready")

    # 2. Validar que la unidad exista antes de lanzar nada en segundo plano
    try:
        shutil.disk_usage(drive)
    except FileNotFoundError:
        return error_response(404, "DRIVE_NOT_FOUND", f"La unidad '{drive}' no existe.")
    except OSError as e:
        return error_response(500, "DISK_READ_ERROR", f"No se pudo leer la unidad: {e}")

    # 3. Lanzar el análisis en segundo plano (si no hay uno ya corriendo para esta unidad)
    if drive not in RUNNING_ANALYSIS:
        RUNNING_ANALYSIS.add(drive)
        background_tasks.add_task(run_full_analysis_and_save, drive)

    # 4. Responder de inmediato, sin esperar a que termine:
    #    - si había un análisis previo, se devuelve marcado como "stale_refreshing"
    #      (el frontend puede mostrarlo ya, con un indicador de "actualizando...")
    #    - si es la primera vez y no hay nada guardado, se responde 202 sin datos,
    #      indicando que el análisis está en curso.
    if cached_row:
        return row_to_response(cached_row, status="stale_refreshing")

    body = APIResponse(success=True, data={"drive": drive, "status": "analyzing"})
    return JSONResponse(status_code=202, content=body.model_dump())