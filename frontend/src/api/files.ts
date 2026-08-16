// src/api/files.ts
// Conexión completa al módulo de Archivos (los 9 endpoints del contrato).

const API_BASE = "http://localhost:8000/api/v1";

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  timestamp: string;
}

export interface DetectedType {
  mime: string;
  category: string;
  suggested_extension: string | null;
}

export interface FileListItem {
  name: string;
  type: "file" | "folder";
  size_bytes: number | null;
  item_count: number | null;
  detected_type: DetectedType | null;
  modified_at: string;
  is_protected: boolean;
}

export interface ListFolderData {
  current_path: string;
  total_items: number;
  items: FileListItem[];
}

export async function listFolder(
  path: string,
): Promise<APIResponse<ListFolderData>> {
  const res = await fetch(
    `${API_BASE}/files/list?path=${encodeURIComponent(path)}`,
  );
  return res.json();
}

export async function createFolder(
  path: string,
  name: string,
): Promise<APIResponse<any>> {
  const res = await fetch(`${API_BASE}/files/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, name }),
  });
  return res.json();
}

export async function createFile(
  path: string,
  name: string,
  content: string = "",
): Promise<APIResponse<any>> {
  const res = await fetch(`${API_BASE}/files/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, name, content }),
  });
  return res.json();
}

export async function renameItem(
  current_path: string,
  new_name: string,
): Promise<APIResponse<any>> {
  const res = await fetch(`${API_BASE}/files/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_path, new_name }),
  });
  return res.json();
}

export async function deleteItem(path: string): Promise<APIResponse<any>> {
  const res = await fetch(
    `${API_BASE}/files?path=${encodeURIComponent(path)}`,
    {
      method: "DELETE",
    },
  );
  return res.json();
}

export async function moveItem(
  current_path: string,
  destination_path: string,
  overwrite: boolean = false,
): Promise<APIResponse<any>> {
  const res = await fetch(`${API_BASE}/files/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_path, destination_path, overwrite }),
  });
  return res.json();
}

export async function convertItem(
  current_path: string,
  target_type: string,
  new_name?: string,
): Promise<APIResponse<any>> {
  const res = await fetch(`${API_BASE}/files/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_path,
      target_type,
      new_name: new_name || null,
    }),
  });
  return res.json();
}
