"""
routers/hardware.py
Endpoints del módulo "Monitor de Hardware" (Iteración 1).
3.1 es un WebSocket (no un endpoint HTTP normal) — transmite datos cada 1 segundo.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import psutil
import asyncio
import time
import shutil

from database import get_connection
from models import APIResponse
from routers.files import now_iso, error_response

router = APIRouter(prefix="/api/v1/hardware", tags=["Hardware"])


# ---------------------------------------------------------------------------
# 3.1 — Hardware en tiempo real (CPU, RAM, disco I/O)
# ---------------------------------------------------------------------------

@router.websocket("/live")
async def hardware_live(websocket: WebSocket):
    await websocket.accept()

    # psutil.cpu_percent() necesita una primera llamada "de calentamiento" —
    # la primera lectura después de iniciar el proceso no es confiable.
    psutil.cpu_percent(interval=None)
    psutil.cpu_percent(interval=None, percpu=True)

    prev_io = psutil.disk_io_counters()
    prev_time = time.time()

    try:
        while True:
            await asyncio.sleep(1)  # intervalo de transmisión: 1 segundo, como definimos

            cpu_overall = psutil.cpu_percent(interval=None)
            cpu_cores = psutil.cpu_percent(interval=None, percpu=True)
            freq = psutil.cpu_freq()
            mem = psutil.virtual_memory()

            # Disco I/O: psutil solo da contadores acumulados desde que prendiste el PC,
            # así que la "velocidad" se calcula como diferencia entre dos lecturas / tiempo transcurrido.
            now = time.time()
            io = psutil.disk_io_counters()
            elapsed = now - prev_time
            read_speed = (io.read_bytes - prev_io.read_bytes) / elapsed if elapsed > 0 else 0
            write_speed = (io.write_bytes - prev_io.write_bytes) / elapsed if elapsed > 0 else 0
            prev_io = io
            prev_time = now

            message = {
                "type": "hardware_update",
                "data": {
                    "cpu": {
                        "overall_percentage": cpu_overall,
                        "cores": [{"core_id": i, "percentage": p} for i, p in enumerate(cpu_cores)],
                        "core_count_physical": psutil.cpu_count(logical=False),
                        "core_count_logical": psutil.cpu_count(logical=True),
                        "frequency_mhz": round(freq.current) if freq else None
                    },
                    "ram": {
                        "total_bytes": mem.total,
                        "used_bytes": mem.used,
                        "available_bytes": mem.available,
                        "used_percentage": mem.percent
                    },
                    "disk_io": {
                        "read_speed_bytes_per_sec": round(read_speed),
                        "write_speed_bytes_per_sec": round(write_speed)
                    }
                },
                "timestamp": now_iso()
            }
            await websocket.send_json(message)

    except WebSocketDisconnect:
        # El cliente cerró la pestaña o se desconectó — comportamiento normal, no es un error.
        pass
    except Exception as e:
        # Un error puntual leyendo sensores no debe cortar la conexión (según el contrato),
        # pero si algo grave pasa (ej. proceso sin permisos), lo informamos antes de terminar.
        try:
            await websocket.send_json({
                "type": "error",
                "error": {"code": "HARDWARE_READ_ERROR", "message": str(e)},
                "timestamp": now_iso()
            })
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 3.2 — Estado general resumido
# ---------------------------------------------------------------------------

def value_status(value: float, good_max: float, regular_max: float) -> str:
    if value < good_max:
        return "bien"
    elif value <= regular_max:
        return "regular"
    return "mal"


@router.get("/status", summary="Estado general resumido de hardware")
def hardware_status():
    # 1. Medir CPU, RAM y espacio en disco del sistema (C:) ahora mismo
    try:
        cpu_value = psutil.cpu_percent(interval=0.5)  # medio segundo de muestreo para un dato confiable
        ram_value = psutil.virtual_memory().percent
        disk_usage = shutil.disk_usage("C:")
        disk_value = round((disk_usage.used / disk_usage.total) * 100, 1)
    except Exception as e:
        return error_response(500, "HARDWARE_READ_ERROR", f"No se pudo leer el estado de hardware: {e}")

    # 2. Leer los umbrales configurables desde SQLite (nunca hardcodeados)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT metric, good_max, regular_max, weight FROM hardware_thresholds")
    thresholds = {row["metric"]: row for row in cursor.fetchall()}
    conn.close()

    values = {"cpu": cpu_value, "ram": ram_value, "disk_space": disk_value}
    factors = []
    weighted_score = 0.0

    for metric, value in values.items():
        t = thresholds.get(metric)
        if not t:
            continue  # umbral no configurado para esta métrica: se omite del cálculo
        status = value_status(value, t["good_max"], t["regular_max"])
        weight = t["weight"]
        factors.append({"metric": metric, "status": status, "value": value, "weight": weight})
        weighted_score += weight * value  # promedio ponderado directo del uso real (%)

    score = round(weighted_score, 1)

    # Mientras más alto el porcentaje de uso, peor: se invierte la lógica
    # respecto a un "score de salud" — aquí el score ES el porcentaje de carga.
    if score < 50:
        overall_status = "bien"
    elif score < 80:
        overall_status = "regular"
    else:
        overall_status = "mal"

    # 3. Responder éxito
    data = {
        "overall_status": overall_status,
        "score": score,
        "factors": factors,
        "measured_at": now_iso()
    }
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())