// src/pages/Red.tsx
// 4 pestañas reales (cambian de vista, no todo apilado con scroll — la
// Opción A que confirmaste en su momento). El test de velocidad es una
// acción explícita del usuario (botón), nunca automática al abrir la pestaña,
// porque tarda demasiado para dispararse solo cada vez que entras aquí.

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getNetworkStatus,
  NetworkStatusData,
  runSpeedtest,
  SpeedtestData,
  getNetworkPorts,
  PortInfo,
  getNetworkDevices,
  DeviceInfo,
} from "../api/network";

type Tab = "estado" | "velocidad" | "puertos" | "dispositivos";

const TABS: { id: Tab; label: string }[] = [
  { id: "estado", label: "Estado" },
  { id: "velocidad", label: "Velocidad" },
  { id: "puertos", label: "Puertos" },
  { id: "dispositivos", label: "Dispositivos" },
];

// --- Pestaña: Estado ---
function EstadoTab() {
  const [data, setData] = useState<NetworkStatusData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    getNetworkStatus()
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
          setStatus("ready");
        } else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading")
    return <span className="text-text-secondary text-sm">Cargando...</span>;
  if (status === "error" || !data)
    return <span className="text-red-400 text-sm">No se pudo conectar.</span>;

  const fields = [
    ["Estado", data.is_connected ? "Conectado" : "Desconectado"],
    ["Tipo", data.connection_type === "wifi" ? "WiFi" : "Ethernet"],
    ["Red", data.network_name ?? "—"],
    [
      "Señal",
      data.signal_strength_percentage !== null
        ? `${data.signal_strength_percentage}%`
        : "—",
    ],
    ["IP local", data.local_ip],
    ["IP pública", data.public_ip],
    ["Gateway", data.gateway_ip ?? "—"],
    ["Adaptador", data.adapter_name],
  ];

  return (
    <div className="bg-surface rounded-2xl p-6 grid grid-cols-4 gap-6">
      {fields.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-xs text-text-secondary">{label}</span>
          <span className="font-bold">{value}</span>
        </div>
      ))}
    </div>
  );
}

// --- Pestaña: Velocidad ---
function VelocidadTab() {
  const [result, setResult] = useState<SpeedtestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTest() {
    setLoading(true);
    setError("");
    const res = await runSpeedtest("full");
    setLoading(false);
    if (res.success && res.data) setResult(res.data);
    else setError(res.error?.message || "No se pudo completar la prueba.");
  }

  return (
    <div className="bg-surface rounded-2xl p-6 flex flex-col gap-4">
      <button
        onClick={handleTest}
        disabled={loading}
        className="bg-accent px-5 py-2.5 rounded-lg text-sm font-medium self-start disabled:opacity-50"
      >
        {loading ? "Midiendo... (puede tardar hasta 30s)" : "Medir velocidad"}
      </button>

      {error && <span className="text-red-400 text-sm">{error}</span>}

      {result && (
        <div className="grid grid-cols-4 gap-6 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Descarga</span>
            <span className="text-2xl font-bold">
              {result.download_mbps ?? "—"} Mbps
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Subida</span>
            <span className="text-2xl font-bold">
              {result.upload_mbps ?? "—"} Mbps
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Ping</span>
            <span className="text-2xl font-bold">{result.ping_ms} ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Jitter</span>
            <span className="text-2xl font-bold">
              {result.jitter_ms ?? "—"} ms
            </span>
          </div>
          <div className="col-span-4 text-xs text-text-secondary">
            Servidor: {result.server_used}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Pestaña: Puertos ---
function PuertosTab() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    getNetworkPorts()
      .then((res) => {
        if (res.success && res.data) {
          setPorts(res.data.ports);
          setStatus("ready");
        } else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading")
    return <span className="text-text-secondary text-sm">Cargando...</span>;
  if (status === "error")
    return <span className="text-red-400 text-sm">No se pudo conectar.</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex px-5 py-2 text-xs font-medium text-text-secondary">
        <span className="flex-1">Puerto</span>
        <span className="flex-1">Protocolo</span>
        <span className="flex-2">Proceso</span>
        <span className="flex-1">PID</span>
        <span className="flex-2">Dirección local</span>
      </div>
      {ports.map((p, i) => (
        <div
          key={i}
          className="flex items-center bg-surface rounded-lg px-5 py-2.5 text-sm"
        >
          <span className="flex-1 font-medium">{p.port}</span>
          <span className="flex-1 text-text-secondary">{p.protocol}</span>
          <span className="flex-2 text-text-secondary">
            {p.process_name ?? "—"}
          </span>
          <span className="flex-1 text-text-secondary">{p.pid ?? "—"}</span>
          <span className="flex-2 text-text-secondary">
            {p.local_address}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Pestaña: Dispositivos ---
function DispositivosTab() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    getNetworkDevices()
      .then((res) => {
        if (res.success && res.data) {
          setDevices(res.data.devices);
          setStatus("ready");
        } else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading")
    return <span className="text-text-secondary text-sm">Cargando...</span>;
  if (status === "error")
    return <span className="text-red-400 text-sm">No se pudo conectar.</span>;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-text-secondary px-5 pb-2">
        Basado en la tabla ARP: solo aparecen dispositivos con los que tu PC se
        ha comunicado recientemente.
      </p>
      <div className="flex px-5 py-2 text-xs font-medium text-text-secondary">
        <span className="flex-2">IP</span>
        <span className="flex-2">MAC</span>
        <span className="flex-2">Fabricante</span>
        <span className="flex-1">Gateway</span>
      </div>
      {devices.map((d) => (
        <div
          key={d.ip_address}
          className="flex items-center bg-surface rounded-lg px-5 py-2.5 text-sm"
        >
          <span className="flex-2 font-medium">{d.ip_address}</span>
          <span className="flex-2 text-text-secondary">{d.mac_address}</span>
          <span className="flex-2 text-text-secondary">
            {d.vendor ?? "—"}
          </span>
          <span className="flex-1 text-text-secondary">
            {d.is_gateway ? "Sí" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Red() {
  const [activeTab, setActiveTab] = useState<Tab>("estado");

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto flex flex-col gap-5">
        <h1 className="text-2xl font-bold">Red</h1>

        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-accent"
                  : "bg-surface text-text-secondary hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "estado" && <EstadoTab />}
        {activeTab === "velocidad" && <VelocidadTab />}
        {activeTab === "puertos" && <PuertosTab />}
        {activeTab === "dispositivos" && <DispositivosTab />}
      </main>
    </div>
  );
}
