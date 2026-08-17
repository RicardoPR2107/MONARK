// src/components/RenameModal.tsx

import { useState } from "react";
import { renameItem } from "../api/files";

interface Props {
  currentFullPath: string;
  currentName: string;
  onClose: () => void;
  onDone: () => void;
}

export default function RenameModal({
  currentFullPath,
  currentName,
  onClose,
  onDone,
}: Props) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRename() {
    if (!name.trim() || name === currentName) return;
    setLoading(true);
    setError("");
    const res = await renameItem(currentFullPath, name.trim());
    setLoading(false);
    if (res.success) {
      onDone();
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
        <h2 className="text-lg font-bold text-text-primary">Renombrar</h2>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
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
            onClick={handleRename}
            disabled={loading || !name.trim() || name === currentName}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-primary disabled:opacity-50"
          >
            {loading ? "Renombrando..." : "Renombrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
