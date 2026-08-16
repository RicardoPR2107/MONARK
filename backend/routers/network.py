"""
routers/network.py
Endpoints del módulo "Red" (Iteración 1).
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import psutil
import socket
import subprocess
import re
import json
import urllib.request
import asyncio

from models import APIResponse
from routers.files import now_iso, error_response

try:
    from mac_vendor_lookup import AsyncMacLookup
    mac_lookup = AsyncMacLookup()
except ImportError:
    mac_lookup = None  # si la librería no está instalada, simplemente no se resuelve el fabricante


def get_vendor(mac: str) -> str | None:
    """La librería mac-vendor-lookup expone su método lookup() como corrutina (async),
    así que la ejecutamos con asyncio.run() aquí, dentro de una función síncrona normal."""
    if not mac_lookup:
        return None
    try:
        return asyncio.run(mac_lookup.lookup(mac))
    except Exception:
        return None


router = APIRouter(prefix="/api/v1/network", tags=["Red"])


def get_local_ip():
    """
    Truco estándar: 'conectamos' un socket UDP a una IP externa (no envía datos
    de verdad) solo para preguntarle al sistema operativo qué IP local usaría
    para salir a internet — así sabemos la IP real de la interfaz activa.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def get_adapter_info(local_ip: str | None):
    """Busca qué adaptador de red tiene esa IP local, para saber su nombre y si es WiFi/Ethernet."""
    if not local_ip:
        return None, "disconnected"
    for name, addr_list in psutil.net_if_addrs().items():
        for addr in addr_list:
            if addr.family == socket.AF_INET and addr.address == local_ip:
                lname = name.lower()
                if "wi-fi" in lname or "wireless" in lname or "wlan" in lname:
                    conn_type = "wifi"
                elif "ethernet" in lname or "lan" in lname:
                    conn_type = "ethernet"
                else:
                    conn_type = "wifi"  # valor por defecto razonable si el nombre no da pistas claras
                return name, conn_type
    return None, "disconnected"


def get_gateway_ip():
    """
    IP del router, extraída de la salida de 'ipconfig' (Windows no da esto por API directa).
    Nota: en muchos adaptadores, la línea de 'Puerta de enlace' trae primero una
    dirección IPv6, y la IPv4 real aparece recién en la línea siguiente — por eso
    se usa [\\s\\S]*? (cualquier caracter, incluyendo saltos de línea) para saltar
    sobre eso sin confundirse con los números que trae la IPv6 de por medio.
    """
    try:
        output = subprocess.check_output(["ipconfig"], encoding="cp850", errors="ignore")
    except Exception:
        return None
    match = re.search(r"(?:Gateway|[Pp]uerta de enlace)[\s\S]*?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", output)
    return match.group(1) if match else None


def get_wifi_details():
    """SSID y fuerza de señal, vía 'netsh wlan show interfaces' — solo aplica si estás en WiFi."""
    try:
        output = subprocess.check_output(
            ["netsh", "wlan", "show", "interfaces"], encoding="cp850", errors="ignore"
        )
    except Exception:
        return None, None
    ssid_match = re.search(r"^\s*SSID\s*:\s*(.+)$", output, re.MULTILINE)
    signal_match = re.search(r"(Signal|Se[nñ]al)\s*:\s*(\d+)%", output)
    ssid = ssid_match.group(1).strip() if ssid_match else None
    signal = int(signal_match.group(2)) if signal_match else None
    return ssid, signal


def get_public_ip():
    """La única forma de saber esto es preguntándole a un servicio externo (no hay API local)."""
    try:
        with urllib.request.urlopen("https://api.ipify.org", timeout=3) as response:
            return response.read().decode("utf-8").strip()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 5.1 — Estado básico de conexión
# ---------------------------------------------------------------------------

@router.get("/status", summary="Estado básico de conexión")
def network_status():
    local_ip = get_local_ip()
    adapter_name, connection_type = get_adapter_info(local_ip)

    if not local_ip or connection_type == "disconnected":
        return error_response(503, "NO_CONNECTION", "No hay una red local activa en este momento.")

    gateway_ip = get_gateway_ip()

    network_name = None
    signal_strength = None
    if connection_type == "wifi":
        network_name, signal_strength = get_wifi_details()

    public_ip = get_public_ip()

    if public_ip is None:
        return error_response(503, "NO_CONNECTION", "Hay red local, pero no se detecta salida a internet.")

    data = {
        "is_connected": True,
        "connection_type": connection_type,
        "network_name": network_name,
        "local_ip": local_ip,
        "public_ip": public_ip,
        "gateway_ip": gateway_ip,
        "adapter_name": adapter_name,
        "signal_strength_percentage": signal_strength,
        "measured_at": now_iso()
    }
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 5.2 — Test de velocidad (vía CLI oficial de Ookla, no la librería de Python)
# ---------------------------------------------------------------------------

class SpeedtestRequest(BaseModel):
    test_type: str = "full"  # "full" | "ping_only"


def run_ookla_speedtest(ping_only: bool = False) -> dict:
    """
    Ejecuta el CLI oficial de Ookla (el mismo motor que usa la web speedtest.net),
    pidiendo la salida en formato JSON para poder leerla directo.
    Los flags --accept-license/--accept-gdpr evitan que se quede esperando una
    confirmación interactiva la primera vez que se ejecuta en esta máquina.
    """
    cmd = ["speedtest", "--format=json", "--accept-license", "--accept-gdpr"]
    if ping_only:
        cmd += ["--no-download", "--no-upload"]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "El CLI de Ookla devolvió un error.")
    return json.loads(result.stdout)


@router.post("/speedtest", summary="Test de velocidad")
def speedtest(payload: SpeedtestRequest = SpeedtestRequest()):
    try:
        raw = run_ookla_speedtest(ping_only=(payload.test_type == "ping_only"))
    except FileNotFoundError:
        return error_response(
            500, "SPEEDTEST_SERVER_UNREACHABLE",
            "El CLI de Ookla ('speedtest') no está instalado o no se encuentra en el PATH del sistema."
        )
    except subprocess.TimeoutExpired:
        return error_response(500, "SPEEDTEST_TIMEOUT", "La prueba de velocidad tardó demasiado y se cortó.")
    except Exception as e:
        return error_response(503, "SPEEDTEST_SERVER_UNREACHABLE", f"No se pudo ejecutar la prueba: {e}")

    ping_info = raw.get("ping", {})
    server_info = raw.get("server", {})

    data = {
        "download_mbps": round(raw["download"]["bandwidth"] * 8 / 1_000_000, 1) if "download" in raw else None,
        "upload_mbps": round(raw["upload"]["bandwidth"] * 8 / 1_000_000, 1) if "upload" in raw else None,
        "ping_ms": round(ping_info.get("latency", 0), 1),
        "jitter_ms": round(ping_info.get("jitter", 0), 1),  # el CLI de Ookla sí trae jitter real, a diferencia de la librería anterior
        "server_used": f"{server_info.get('name')} - {server_info.get('location')}",
        "tested_at": now_iso()
    }
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 5.3 — Puertos en uso por la PC
# ---------------------------------------------------------------------------

@router.get("/ports", summary="Puertos en uso por la PC")
def network_ports():
    try:
        connections = psutil.net_connections(kind="inet")
    except psutil.AccessDenied:
        return error_response(403, "PERMISSION_DENIED", "Sin permisos suficientes para leer las conexiones de red.")
    except Exception as e:
        return error_response(500, "NETWORK_READ_ERROR", f"No se pudo leer los puertos: {e}")

    ports = []
    for conn in connections:
        if conn.status != psutil.CONN_LISTEN:
            continue  # solo nos interesan los puertos "escuchando", no todas las conexiones activas

        process_name = None
        if conn.pid:
            try:
                process_name = psutil.Process(conn.pid).name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                process_name = None

        ports.append({
            "port": conn.laddr.port,
            "protocol": "TCP" if conn.type == socket.SOCK_STREAM else "UDP",
            "status": conn.status,
            "process_name": process_name,
            "pid": conn.pid,
            "local_address": conn.laddr.ip
        })

    data = {
        "total_open_ports": len(ports),
        "ports": ports,
        "measured_at": now_iso()
    }
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())


# ---------------------------------------------------------------------------
# 5.4 — Dispositivos conectados a la red local (ARP)
# ---------------------------------------------------------------------------

@router.get("/devices", summary="Dispositivos conectados a la red local (ARP)")
def network_devices():
    gateway_ip = get_gateway_ip()

    try:
        output = subprocess.check_output(["arp", "-a"], encoding="cp850", errors="ignore")
    except Exception as e:
        return error_response(500, "NETWORK_READ_ERROR", f"No se pudo leer la tabla ARP: {e}")

    pattern = re.compile(
        r'^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s+(\w+)',
        re.MULTILINE
    )
    matches = pattern.findall(output)
    scanned_at = now_iso()

    devices = []
    for ip, mac, entry_type in matches:
        # Se descartan direcciones de multicast/broadcast: no son dispositivos reales.
        # El rango de multicast IPv4 completo es 224.0.0.0 a 239.255.255.255
        # (no solo 224.x, como tenía antes — por eso se colaba 239.255.255.250/SSDP).
        first_octet = int(ip.split(".")[0])
        if 224 <= first_octet <= 239 or ip.endswith(".255") or mac.lower() == "ff-ff-ff-ff-ff-ff":
            continue

        try:
            hostname = socket.gethostbyaddr(ip)[0]
        except Exception:
            hostname = None  # no siempre está disponible; no es un error, es normal que falte a veces

        vendor = get_vendor(mac)

        devices.append({
            "ip_address": ip,
            "mac_address": mac.upper(),
            "hostname": hostname,
            "vendor": vendor,
            "is_gateway": (ip == gateway_ip),
            "last_seen": scanned_at  # Windows no da timestamp por entrada; se usa el momento del escaneo
        })

    if not devices:
        return error_response(404, "NO_DEVICES_FOUND", "No se encontraron dispositivos en la tabla ARP.")

    data = {
        "total_devices": len(devices),
        "devices": devices,
        "scanned_at": scanned_at
    }
    body = APIResponse(success=True, data=data)
    return JSONResponse(status_code=200, content=body.model_dump())