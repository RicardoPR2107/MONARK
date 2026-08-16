"""
routers/processes.py
Endpoint del módulo "Procesos y Tareas" (Iteración 1).
4.1 es un WebSocket — transmite la lista completa de procesos cada 1 segundo.
El backend NO ordena ni filtra (decisión ya tomada): eso es responsabilidad del frontend.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import psutil
import asyncio
from datetime import datetime, timezone

from routers.files import now_iso

router = APIRouter(prefix="/api/v1/processes", tags=["Procesos"])


# ---------------------------------------------------------------------------
# 4.1 — Visor de procesos activos
# ---------------------------------------------------------------------------

@router.websocket("/live")
async def processes_live(websocket: WebSocket):
    await websocket.accept()

    # Igual que con CPU en el módulo de hardware: psutil necesita "recordar" el
    # objeto Process entre lecturas para calcular el % de CPU por proceso de forma
    # confiable. Por eso mantenemos un diccionario pid -> Process entre iteraciones,
    # en vez de crear objetos nuevos cada segundo.
    tracked: dict[int, psutil.Process] = {}

    try:
        while True:
            current_pids = set()
            processes_data = []

            for proc in psutil.process_iter(["pid", "name", "memory_info", "status", "create_time"]):
                try:
                    pid = proc.info["pid"]

                    # System Idle Process (PID 0 en Windows) no es un proceso real —
                    # es el contador inverso del tiempo que el CPU NO está trabajando.
                    # psutil da lecturas poco confiables para él (puede superar 100%), se excluye.
                    if pid == 0:
                        continue

                    current_pids.add(pid)

                    if pid not in tracked:
                        p = psutil.Process(pid)
                        p.cpu_percent(interval=None)  # lectura de calentamiento (primera vez este proceso da 0%)
                        tracked[pid] = p

                    cpu_pct = tracked[pid].cpu_percent(interval=None)
                    mem = proc.info["memory_info"]
                    created = proc.info["create_time"]

                    processes_data.append({
                        "pid": pid,
                        "name": proc.info["name"],
                        "cpu_percentage": cpu_pct,
                        "ram_bytes": mem.rss if mem else 0,
                        "status": proc.info["status"],
                        "started_at": (
                            datetime.fromtimestamp(created, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                            if created else None
                        )
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    # El proceso terminó o no tenemos permiso de leerlo justo en este instante: se omite
                    continue

            # Dejar de rastrear procesos que ya no existen (evita que el diccionario crezca sin límite)
            for pid in list(tracked.keys()):
                if pid not in current_pids:
                    del tracked[pid]

            message = {
                "type": "processes_update",
                "data": {
                    "total_processes": len(processes_data),
                    "processes": processes_data  # sin ordenar ni filtrar, tal como se definió
                },
                "timestamp": now_iso()
            }
            await websocket.send_json(message)
            await asyncio.sleep(1)  # mismo intervalo que hardware: 1 segundo

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "error": {"code": "PROCESS_READ_ERROR", "message": str(e)},
                "timestamp": now_iso()
            })
        except Exception:
            pass