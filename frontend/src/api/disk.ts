// src/api/disk.ts
// Funciones que hablan directo con tu backend FastAPI (módulo Disco).
// Todas devuelven el JSON tal cual lo manda la API, sin transformarlo aquí.

const API_BASE = "http://localhost:8000/api/v1";

export interface DiskAnalysisData {
  drive: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percentage: number;
  breakdown: Record<
    string,
    {
      bytes: number;
      label: string;
      protected: boolean;
      cleanable?: boolean;
    }
  >;
  analyzed_at: string;
  status?: "ready" | "stale_refreshing" | "analyzing";
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  timestamp: string;
}

export async function getDiskAnalysis(
  drive: string = "C:",
  refresh: boolean = false,
): Promise<APIResponse<DiskAnalysisData>> {
  const url = `${API_BASE}/disk/analysis?drive=${encodeURIComponent(drive)}&refresh=${refresh}`;
  const response = await fetch(url);
  return response.json();
}

export interface DriveInfo {
  letter: string;
  label: string;
  total_bytes: number;
  filesystem: string;
}

export async function getDiskList(): Promise<
  APIResponse<{ drives: DriveInfo[] }>
> {
  const response = await fetch(`${API_BASE}/disk/list`);
  return response.json();
}
