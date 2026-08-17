// src/api/hardware.ts

const API_BASE = "http://localhost:8000/api/v1";

export interface HardwareFactor {
  metric: string;
  status: "bien" | "regular" | "mal";
  value: number;
  weight: number;
}

export interface HardwareStatusData {
  overall_status: "bien" | "regular" | "mal";
  score: number;
  factors: HardwareFactor[];
  measured_at: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  timestamp: string;
}

export interface HardwareLiveData {
  cpu: {
    overall_percentage: number;
    cores: { core_id: number; percentage: number }[];
    core_count_physical: number;
    core_count_logical: number;
    frequency_mhz: number | null;
  };
  ram: {
    total_bytes: number;
    used_bytes: number;
    available_bytes: number;
    used_percentage: number;
  };
  disk_io: {
    read_speed_bytes_per_sec: number;
    write_speed_bytes_per_sec: number;
  };
}

export async function getHardwareStatus(): Promise<
  APIResponse<HardwareStatusData>
> {
  const response = await fetch(`${API_BASE}/hardware/status`);
  return response.json();
}
