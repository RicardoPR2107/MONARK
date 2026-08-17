// src/api/processes.ts
// Este módulo solo tiene un WebSocket (sin REST), así que aquí solo van
// los tipos — la conexión en sí se hace directo en el componente que lo usa.

export interface ProcessItem {
  pid: number;
  name: string;
  cpu_percentage: number;
  ram_bytes: number;
  status: string;
  started_at: string | null;
}

export interface ProcessesLiveData {
  total_processes: number;
  processes: ProcessItem[];
}
