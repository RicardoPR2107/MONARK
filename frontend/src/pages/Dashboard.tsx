// src/pages/Dashboard.tsx
// La sección de disco ahora es dinámica: primero se pide la lista de unidades
// (getDiskList, Endpoint 2.9) y se renderiza una tarjeta independiente por
// cada una (C:, D:, o las que existan), cada tarjeta con su propio análisis
// y su propio polling — así C: puede seguir "Analizando..." mientras D: ya
// muestra resultado, sin que se bloqueen entre sí.

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getDiskAnalysis,
  getDiskList,
  DiskAnalysisData,
  DriveInfo,
} from "../api/disk";
import { getHardwareStatus, HardwareStatusData } from "../api/hardware";
import { getNetworkStatus, NetworkStatusData } from "../api/network";

function formatGB(bytes: number): string {
  // Usamos la convención DECIMAL (1 GB = 1,000,000,000 bytes), que es el
  // estándar SI real — la misma que usan los fabricantes de discos, macOS y
  // Linux. Windows Explorer usa una convención binaria distinta (1024^3) pero
  // la etiqueta mal como "GB" — no heredamos esa inconsistencia en nuestra app.
  return (bytes / 1_000_000_000).toFixed(1) + " GB";
}

const STATUS_LABEL: Record<string, string> = {
  bien: "Bien",
  regular: "Regular",
  mal: "Mal",
};

// --- Tarjeta individual de disco, autosuficiente (pide y sondea su propia unidad) ---
function DiskDriveCard({ letter }: { letter: string }) {
  const [disk, setDisk] = useState<DiskAnalysisData | null>(null);
  const [status, setStatus] = useState<
    "loading" | "analyzing" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function fetchDisk() {
      try {
        const res = await getDiskAnalysis(letter);
        if (cancelled) return;
        if (res.success && res.data) {
          setDisk(res.data);
          if (res.data.status === "ready" || !res.data.status) {
            setStatus("ready");
          } else {
            setStatus("analyzing");
            timer = setTimeout(fetchDisk, 5000);
          }
        } else {
          setStatus("analyzing");
          timer = setTimeout(fetchDisk, 5000);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    fetchDisk();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [letter]);

  return (
    <div className="bg-surface rounded-2xl p-6 flex flex-col gap-3 flex-1 min-w-55">
      <span className="text-sm font-medium text-text-secondary">
        Unidad {letter}
      </span>

      {status === "loading" && (
        <span className="text-text-secondary text-sm">Cargando...</span>
      )}
      {status === "analyzing" && (
        <>
          <span className="text-xl font-bold">Analizando...</span>
          <span className="text-xs text-text-secondary">
            Puede tardar unos minutos la primera vez.
          </span>
        </>
      )}
      {status === "error" && (
        <span className="text-red-400 text-sm">
          No se pudo leer esta unidad.
        </span>
      )}
      {status === "ready" && disk && (
        <>
          <span className="text-3xl font-bold">{disk.used_percentage}%</span>
          <span className="text-xs text-text-secondary">
            {formatGB(disk.used_bytes)} usados de {formatGB(disk.total_bytes)}
          </span>
          <span className="text-xs text-text-secondary">
            {formatGB(disk.free_bytes)} disponibles
          </span>
          <div className="w-full h-2 bg-white/10 rounded-full mt-1">
            <div
              className="h-2 bg-accent rounded-full"
              style={{ width: `${disk.used_percentage}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [drivesStatus, setDrivesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [hardware, setHardware] = useState<HardwareStatusData | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [network, setNetwork] = useState<NetworkStatusData | null>(null);
  const [networkStatus, setNetworkStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  // --- Lista de discos disponibles (Endpoint 2.9) ---
  useEffect(() => {
    getDiskList()
      .then((res) => {
        if (res.success && res.data) {
          setDrives(res.data.drives);
          setDrivesStatus("ready");
        } else {
          setDrivesStatus("error");
        }
      })
      .catch(() => setDrivesStatus("error"));
  }, []);

  // --- Hardware ---
  useEffect(() => {
    getHardwareStatus()
      .then((res) => {
        if (res.success && res.data) {
          setHardware(res.data);
          setHardwareStatus("ready");
        } else {
          setHardwareStatus("error");
        }
      })
      .catch(() => setHardwareStatus("error"));
  }, []);

  // --- Red ---
  useEffect(() => {
    getNetworkStatus()
      .then((res) => {
        if (res.success && res.data) {
          setNetwork(res.data);
          setNetworkStatus("ready");
        } else {
          setNetworkStatus("error");
        }
      })
      .catch(() => setNetworkStatus("error"));
  }, []);

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Gestor del Sistema</h1>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            En línea
          </div>
        </header>

        {/* Sección de discos: una tarjeta por cada unidad detectada */}
        <div className="mb-6">
          <span className="text-sm font-medium text-text-secondary mb-3 block">
            Almacenamiento
          </span>
          {drivesStatus === "loading" && (
            <span className="text-text-secondary text-sm">
              Cargando unidades...
            </span>
          )}
          {drivesStatus === "error" && (
            <span className="text-red-400 text-sm">
              No se pudo conectar con el backend.
            </span>
          )}
          {drivesStatus === "ready" && (
            <div className="flex gap-6">
              {drives.map((d) => (
                <DiskDriveCard key={d.letter} letter={d.letter} />
              ))}
            </div>
          )}
        </div>

        {/* Hardware y Red */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-3">
            <span className="text-sm font-medium text-text-secondary">
              Hardware
            </span>
            {hardwareStatus === "loading" && (
              <span className="text-text-secondary text-sm">Cargando...</span>
            )}
            {hardwareStatus === "error" && (
              <span className="text-red-400 text-sm">
                No se pudo conectar con el backend.
              </span>
            )}
            {hardwareStatus === "ready" && hardware && (
              <>
                <span className="text-2xl font-bold">
                  {STATUS_LABEL[hardware.overall_status]}
                </span>
                <span className="text-xs text-text-secondary">
                  {hardware.factors
                    .map((f) => `${f.metric.toUpperCase()} ${f.value}%`)
                    .join(" · ")}
                </span>
              </>
            )}
          </div>

          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-3">
            <span className="text-sm font-medium text-text-secondary">Red</span>
            {networkStatus === "loading" && (
              <span className="text-text-secondary text-sm">Cargando...</span>
            )}
            {networkStatus === "error" && (
              <span className="text-red-400 text-sm">
                No se pudo conectar con el backend.
              </span>
            )}
            {networkStatus === "ready" && network && (
              <>
                <span className="text-2xl font-bold">
                  {network.is_connected ? "En línea" : "Sin conexión"}
                </span>
                <span className="text-xs text-text-secondary">
                  {network.connection_type === "wifi" ? "WiFi" : "Ethernet"} ·{" "}
                  {network.local_ip}
                </span>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
