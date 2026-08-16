// src/api/network.ts

const API_BASE = "http://localhost:8000/api/v1";

export interface NetworkStatusData {
  is_connected: boolean;
  connection_type: "wifi" | "ethernet" | "disconnected";
  network_name: string | null;
  local_ip: string;
  public_ip: string;
  gateway_ip: string | null;
  adapter_name: string;
  signal_strength_percentage: number | null;
  measured_at: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  timestamp: string;
}

export async function getNetworkStatus(): Promise<
  APIResponse<NetworkStatusData>
> {
  const response = await fetch(`${API_BASE}/network/status`);
  return response.json();
}
