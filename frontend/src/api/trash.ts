// src/api/trash.ts
// Solo lectura en Iteración 1 — restaurar/purgar quedan para Iteración 2.

const API_BASE = "http://localhost:8000/api/v1";

export interface TrashItem {
  id: number;
  original_path: string;
  trash_path: string;
  name: string;
  type: "file" | "folder";
  size_bytes: number | null;
  deleted_at: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  timestamp: string;
}

export async function getTrashItems(): Promise<
  APIResponse<{ total_items: number; items: TrashItem[] }>
> {
  const response = await fetch(`${API_BASE}/files/trash`);
  return response.json();
}
