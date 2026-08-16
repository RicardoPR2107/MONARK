// src/components/CreateItemModal.tsx
// Modal pequeño y centrado, tal como lo pediste — reemplaza lo que habíamos
// dejado pendiente de maquetar en Figma antes del límite de llamadas.

import { useState } from "react";

interface Props {
  type: "folder" | "file";
  currentPath: string;
  onClose: () => void;
  onCreated: () => void;
  createFn: (
    path: string,
    name: string,
  ) => Promise<{ success: boolean; error: { message: string } | null }>;
}

export default function CreateItemModal({
  type,
  currentPath,
  onClose,
  onCreated,
  createFn,
}: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    const res = await createFn(currentPath, name.trim());
    setLoading(false);
    if (res.success) {
      onCreated();
      onClose();
    } else {
      setError(res.error?.message || "Ocurrió un error.");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl p-6 w-96 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">
          {type === "folder" ? "Crear carpeta" : "Crear archivo"}
        </h2>

        <p className="text-xs text-text-secondary">Ubicación: {currentPath}</p>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder={
            type === "folder"
              ? "Nombre de la carpeta"
              : "Nombre del archivo (sin extensión)"
          }
          className="bg-white/5 text-text-primary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        {error && <span className="text-red-400 text-xs">{error}</span>}

        <div className="flex justify-end gap-3 mt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-primary disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
