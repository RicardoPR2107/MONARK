// src/components/ConvertModal.tsx
// Lista fija de tipos destino según el alcance que definimos (Nivel 1 y 2):
// TXT<->Markdown, imágenes PNG/JPG/WEBP, TXT/DOCX -> PDF.

import { useState } from "react";
import { convertItem } from "../api/files";

interface Props {
  currentFullPath: string;
  itemName: string;
  onClose: () => void;
  onDone: (result: { name: string; mime: string }) => void;
}

const TARGET_OPTIONS = [
  { value: "markdown", label: "Markdown (.md)" },
  { value: "text_plain", label: "Texto plano (.txt)" },
  { value: "png", label: "Imagen PNG" },
  { value: "jpg", label: "Imagen JPG" },
  { value: "webp", label: "Imagen WEBP" },
  { value: "pdf", label: "PDF" },
];

export default function ConvertModal({
  currentFullPath,
  itemName,
  onClose,
  onDone,
}: Props) {
  const [targetType, setTargetType] = useState("markdown");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConvert() {
    setLoading(true);
    setError("");
    const res = await convertItem(
      currentFullPath,
      targetType,
      newName.trim() || undefined,
    );
    setLoading(false);
    if (res.success && res.data) {
      // El nombre real del archivo creado (por si el backend generó uno
      // automático, ej. "archivo_converted") viene en converted_path.
      const createdName =
        res.data.converted_path.split(/[/\\]/).pop() || newName.trim();
      onDone({ name: createdName, mime: res.data.new_type });
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
          Convertir "{itemName}"
        </h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-secondary">Convertir a</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="bg-white/5 text-text-primary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-secondary">
            Nombre del archivo convertido (opcional)
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Se genera automático si lo dejas vacío"
            className="bg-white/5 text-text-primary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && <span className="text-red-400 text-xs">{error}</span>}

        <div className="flex justify-end gap-3 mt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-primary disabled:opacity-50"
          >
            {loading ? "Convirtiendo..." : "Convertir"}
          </button>
        </div>
      </div>
    </div>
  );
}
