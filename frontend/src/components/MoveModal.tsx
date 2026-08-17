// src/components/MoveModal.tsx
// LIMITACIÓN ACTUAL: el destino se escribe como texto (ruta completa), no hay
// todavía un explorador visual de carpetas para elegir destino haciendo clic.
// Es funcional, pero menos cómodo que "arrastrar y soltar" — queda anotado
// como mejora posible para más adelante (un selector de carpetas tipo árbol).

import { useState } from "react";
import { moveItem } from "../api/files";

interface Props {
  currentFullPath: string;
  itemName: string;
  onClose: () => void;
  onDone: () => void;
}

export default function MoveModal({
  currentFullPath,
  itemName,
  onClose,
  onDone,
}: Props) {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] = useState(false);

  async function handleMove(overwrite: boolean = false) {
    if (!destination.trim()) return;
    setLoading(true);
    setError("");
    const res = await moveItem(currentFullPath, destination.trim(), overwrite);
    setLoading(false);

    if (res.success) {
      onDone();
      onClose();
    } else if (res.error?.code === "NAME_ALREADY_EXISTS" && !overwrite) {
      setNeedsOverwriteConfirm(true);
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
          Mover "{itemName}"
        </h2>

        <p className="text-xs text-text-secondary">
          Ruta completa de la carpeta destino (ej. D:/MONARK/Proyectos)
        </p>

        <input
          autoFocus
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="D:/carpeta/destino"
          className="bg-white/5 text-text-primary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        {error && <span className="text-red-400 text-xs">{error}</span>}

        {needsOverwriteConfirm && (
          <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-2">
            <span className="text-xs text-text-secondary">
              Ya existe un elemento con ese nombre en el destino. ¿Reemplazarlo?
            </span>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNeedsOverwriteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleMove(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/90 hover:bg-red-500 text-text-primary"
              >
                Reemplazar
              </button>
            </div>
          </div>
        )}

        {!needsOverwriteConfirm && (
          <div className="flex justify-end gap-3 mt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleMove(false)}
              disabled={loading || !destination.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-primary disabled:opacity-50"
            >
              {loading ? "Moviendo..." : "Mover"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
