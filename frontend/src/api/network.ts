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

export interface SpeedtestData {
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number;
  jitter_ms: number | null;
  server_used: string;
  tested_at: string;
}

export async function runSpeedtest(
  test_type: "full" | "ping_only" = "full",
): Promise<APIResponse<SpeedtestData>> {
  const response = await fetch(`${API_BASE}/network/speedtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_type }),
  });
  return response.json();
}

export interface PortInfo {
  port: number;
  protocol: string;
  status: string;
  process_name: string | null;
  pid: number | null;
  local_address: string;
}

export async function getNetworkPorts(): Promise<
  APIResponse<{
    total_open_ports: number;
    ports: PortInfo[];
    measured_at: string;
  }>
> {
  const response = await fetch(`${API_BASE}/network/ports`);
  return response.json();
}

export interface DeviceInfo {
  ip_address: string;
  mac_address: string;
  hostname: string | null;
  vendor: string | null;
  is_gateway: boolean;
  last_seen: string;
}

export async function getNetworkDevices(): Promise<
  APIResponse<{
    total_devices: number;
    devices: DeviceInfo[];
    scanned_at: string;
  }>
> {
  const response = await fetch(`${API_BASE}/network/devices`);
  return response.json();
}
