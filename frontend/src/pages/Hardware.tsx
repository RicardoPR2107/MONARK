// src/pages/Hardware.tsx
// Dos WebSockets conectados a la vez: hardware/live (CPU/RAM/disco) y
// processes/live (tabla de procesos). El backend NO ordena la lista de
// procesos — eso es responsabilidad del frontend, como decidimos: clic en
// un encabezado de columna ordena por esa columna, alternando asc/desc.

import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import { HardwareLiveData } from "../api/hardware";
import { ProcessItem } from "../api/processes";

function formatMB(bytes: number): string {
  return (bytes / 1_048_576).toFixed(0) + " MB";
}

type SortKey = "name" | "cpu_percentage" | "ram_bytes" | "pid";

export default function Hardware() {
  const [hw, setHw] = useState<HardwareLiveData | null>(null);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [connected, setConnected] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("cpu_percentage");
  const [sortAsc, setSortAsc] = useState(false);

  const hwSocket = useRef<WebSocket | null>(null);
  const procSocket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws1 = new WebSocket("ws://127.0.0.1:8000/api/v1/hardware/live");
    ws1.onopen = () => setConnected(true);
    ws1.onclose = () => setConnected(false);
    ws1.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "hardware_update") setHw(msg.data);
    };
    hwSocket.current = ws1;

    const ws2 = new WebSocket("ws://127.0.0.1:8000/api/v1/processes/live");
    ws2.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "processes_update") setProcesses(msg.data.processes);
    };
    procSocket.current = ws2;

    return () => {
      ws1.close();
      ws2.close();
    };
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortedProcesses = [...processes].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") diff = a.name.localeCompare(b.name);
    else diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortAsc ? diff : -diff;
  });

  function SortHeader({
    label,
    keyName,
    className,
  }: {
    label: string;
    keyName: SortKey;
    className?: string;
  }) {
    return (
      <button
        onClick={() => toggleSort(keyName)}
        className={`text-left hover:text-text-primary ${className || ""} ${
          sortKey === keyName ? "text-text-primary" : ""
        }`}
      >
        {label} {sortKey === keyName && (sortAsc ? "↑" : "↓")}
      </button>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Hardware y Procesos</h1>
          <span className="text-sm text-text-secondary">
            {connected ? "En vivo" : "Conectando..."}
          </span>
        </header>

        {/* Métricas en vivo */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-2">
            <span className="text-sm font-medium text-text-secondary">CPU</span>
            <span className="text-3xl font-bold">
              {hw ? `${hw.cpu.overall_percentage.toFixed(1)}%` : "—"}
            </span>
            <span className="text-xs text-text-secondary">
              {hw
                ? `${hw.cpu.core_count_physical} núcleos físicos · ${hw.cpu.frequency_mhz ?? "—"} MHz`
                : ""}
            </span>
          </div>

          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-2">
            <span className="text-sm font-medium text-text-secondary">RAM</span>
            <span className="text-3xl font-bold">
              {hw ? `${hw.ram.used_percentage.toFixed(1)}%` : "—"}
            </span>
            <span className="text-xs text-text-secondary">
              {hw
                ? `${formatMB(hw.ram.used_bytes)} de ${formatMB(hw.ram.total_bytes)}`
                : ""}
            </span>
          </div>

          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-2">
            <span className="text-sm font-medium text-text-secondary">
              Disco (I/O)
            </span>
            <span className="text-3xl font-bold">
              {hw
                ? `${(hw.disk_io.read_speed_bytes_per_sec / 1_048_576).toFixed(1)} MB/s`
                : "—"}
            </span>
            <span className="text-xs text-text-secondary">
              {hw
                ? `Escritura: ${(hw.disk_io.write_speed_bytes_per_sec / 1_048_576).toFixed(1)} MB/s`
                : ""}
            </span>
          </div>
        </div>

        {/* Núcleos individuales */}
        {hw && (
          <div className="bg-surface rounded-2xl p-6">
            <span className="text-sm font-medium text-text-secondary mb-3 block">
              Núcleos
            </span>
            <div className="grid grid-cols-8 gap-2">
              {hw.cpu.cores.map((c) => (
                <div
                  key={c.core_id}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-full h-16 bg-white/5 rounded-md flex items-end overflow-hidden">
                    <div
                      className="w-full bg-accent"
                      style={{ height: `${c.percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-secondary">
                    {c.core_id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de procesos */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary mb-1">
            Procesos activos ({processes.length})
          </span>

          <div className="flex px-5 py-2 text-xs font-medium text-text-secondary">
            <SortHeader label="Nombre" keyName="name" className="flex-2" />
            <SortHeader label="PID" keyName="pid" className="flex-1" />
            <SortHeader
              label="CPU %"
              keyName="cpu_percentage"
              className="flex-1"
            />
            <SortHeader label="RAM" keyName="ram_bytes" className="flex-1" />
            <span className="flex-1">Estado</span>
          </div>

          <div className="flex flex-col gap-1 max-h-105 overflow-y-auto">
            {sortedProcesses.map((p) => (
              <div
                key={p.pid}
                className="flex items-center bg-surface rounded-lg px-5 py-2.5"
              >
                <span className="flex-2 text-sm font-medium">{p.name}</span>
                <span className="flex-1 text-sm text-text-secondary">
                  {p.pid}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {p.cpu_percentage.toFixed(1)}%
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {formatMB(p.ram_bytes)}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
