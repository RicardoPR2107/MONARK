// src/pages/Papelera.tsx
// Solo lectura en Iteración 1 — muestra qué hay en la papelera, pero los
// botones de Restaurar/Purgar están deshabilitados con nota explicativa,
// tal como quedó definido: esa funcionalidad llega en Iteración 2.

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getTrashItems, TrashItem } from "../api/trash";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1_073_741_824) return (bytes / 1_048_576).toFixed(1) + " MB";
  return (bytes / 1_073_741_824).toFixed(1) + " GB";
}

function formatDate(iso: string): string {
  return new Date(iso.replace(" ", "T")).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Papelera() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    getTrashItems()
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Papelera</h1>
          <span className="text-xs text-text-secondary">
            Restaurar y purgar disponible en Iteración 2
          </span>
        </header>

        {status === "loading" && (
          <span className="text-text-secondary text-sm">Cargando...</span>
        )}
        {status === "error" && (
          <span className="text-red-400 text-sm">
            No se pudo conectar con el backend.
          </span>
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-1">
            <div className="flex px-5 py-2 text-xs font-medium text-text-secondary">
              <span className="flex-2">Nombre</span>
              <span className="flex-1">Tipo</span>
              <span className="flex-1">Tamaño</span>
              <span className="flex-2">Eliminado el</span>
              <span className="flex-1">Acciones</span>
            </div>

            {items.length === 0 && (
              <span className="text-text-secondary text-sm px-5 py-4">
                La papelera está vacía.
              </span>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center bg-surface rounded-lg px-5 py-3.5"
              >
                <span className="flex-2 font-medium">{item.name}</span>
                <span className="flex-1 text-sm text-text-secondary">
                  {item.type === "folder" ? "Carpeta" : "Archivo"}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {formatSize(item.size_bytes)}
                </span>
                <span className="flex-2 text-sm text-text-secondary">
                  {formatDate(item.deleted_at)}
                </span>
                <span className="flex-1">
                  <button
                    disabled
                    title="Disponible en Iteración 2"
                    className="text-xs text-text-secondary/50 cursor-not-allowed"
                  >
                    Restaurar
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
