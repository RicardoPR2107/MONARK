// src/components/MoveModal.tsx
// Selector visual de carpeta destino: navegas igual que en la pantalla de
// Archivos (Este equipo -> unidad -> carpetas), en vez de escribir la ruta
// a mano. Solo muestra carpetas (no archivos), porque solo puedes mover
// algo DENTRO de una carpeta.

import { useEffect, useState } from "react";
import { moveItem } from "../api/files";
import { getDiskList, DriveInfo } from "../api/disk";
import { listFolder, FileListItem } from "../api/files";
import { FolderIcon, ChipIcon } from "./icons";

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
  // browsePath === null representa "Este equipo" (lista de unidades)
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [folders, setFolders] = useState<FileListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] = useState(false);

  useEffect(() => {
    setLoadingList(true);
    if (browsePath === null) {
      getDiskList().then((res) => {
        if (res.success && res.data) setDrives(res.data.drives);
        setLoadingList(false);
      });
    } else {
      listFolder(browsePath).then((res) => {
        if (res.success && res.data) {
          setFolders(res.data.items.filter((i) => i.type === "folder"));
        }
        setLoadingList(false);
      });
    }
  }, [browsePath]);

  async function handleMove(overwrite: boolean = false) {
    if (browsePath === null) return; // no puedes mover algo directo a "Este equipo"
    setLoading(true);
    setError("");
    const res = await moveItem(currentFullPath, browsePath, overwrite);
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

  const segments = browsePath ? browsePath.split("/").filter(Boolean) : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl p-6 w-120 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">
          Mover "{itemName}"
        </h2>

        {/* Breadcrumb de navegación */}
        <div className="flex items-center gap-1 text-sm flex-wrap bg-white/5 rounded-lg px-3 py-2">
          <button
            onClick={() => setBrowsePath(null)}
            className={
              browsePath === null
                ? "text-text-primary font-medium"
                : "text-text-secondary hover:text-text-primary"
            }
          >
            Este equipo
          </button>
          {segments.map((seg, i) => {
            const pathUpToHere = segments.slice(0, i + 1).join("/") + "/";
            const isLast = i === segments.length - 1;
            return (
              <span key={i} className="flex items-center gap-1">
                <span className="text-text-secondary">›</span>
                <button
                  onClick={() => setBrowsePath(pathUpToHere)}
                  className={
                    isLast
                      ? "text-text-primary font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }
                >
                  {seg}
                </button>
              </span>
            );
          })}
        </div>

        {/* Lista navegable */}
        <div className="h-56 overflow-y-auto flex flex-col gap-1 bg-white/5 rounded-lg p-2">
          {loadingList && (
            <span className="text-text-secondary text-xs px-2 py-1">
              Cargando...
            </span>
          )}

          {!loadingList &&
            browsePath === null &&
            drives.map((d) => (
              <button
                key={d.letter}
                onClick={() => setBrowsePath(`${d.letter}/`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/5"
              >
                <ChipIcon className="w-4 h-4 text-accent shrink-0" />
                Unidad {d.letter}
              </button>
            ))}

          {!loadingList && browsePath !== null && folders.length === 0 && (
            <span className="text-text-secondary text-xs px-3 py-2">
              No hay subcarpetas aquí.
            </span>
          )}

          {!loadingList &&
            browsePath !== null &&
            folders.map((f) => (
              <button
                key={f.name}
                onClick={() =>
                  setBrowsePath(
                    `${browsePath}${browsePath.endsWith("/") ? "" : "/"}${f.name}`,
                  )
                }
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/5"
              >
                <FolderIcon className="w-4 h-4 text-accent shrink-0" />
                {f.name}
              </button>
            ))}
        </div>

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
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleMove(false)}
              disabled={loading || browsePath === null}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-primary disabled:opacity-50"
            >
              {loading ? "Moviendo..." : "Mover aquí"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
