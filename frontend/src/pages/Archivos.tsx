// src/pages/Archivos.tsx
// currentPath === null representa la vista raíz "Este equipo" (lista de unidades,
// reutilizando el mismo getDiskList() del Dashboard). Al hacer clic en una unidad,
// se navega dentro de ella con listFolder(), igual que entre carpetas normales.

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  listFolder,
  createFolder,
  createFile,
  FileListItem,
} from "../api/files";
import { getDiskList, DriveInfo } from "../api/disk";
import { FolderIcon, ChipIcon } from "../components/icons";
import CreateItemModal from "../components/CreateItemModal";

function formatGB(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1_073_741_824) return (bytes / 1_048_576).toFixed(1) + " MB";
  return (bytes / 1_073_741_824).toFixed(1) + " GB";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Archivos() {
  // null = vista raíz "Este equipo"
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [items, setItems] = useState<FileListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState<"folder" | "file" | null>(null);

  function reloadFolder() {
    if (currentPath === null) return;
    listFolder(currentPath).then((res) => {
      if (res.success && res.data) setItems(res.data.items);
    });
  }

  useEffect(() => {
    setStatus("loading");

    if (currentPath === null) {
      // Vista raíz: lista de unidades
      getDiskList()
        .then((res) => {
          if (res.success && res.data) {
            setDrives(res.data.drives);
            setStatus("ready");
          } else {
            setErrorMsg(res.error?.message || "Error desconocido");
            setStatus("error");
          }
        })
        .catch(() => {
          setErrorMsg("No se pudo conectar con el backend.");
          setStatus("error");
        });
    } else {
      // Vista de carpeta normal
      listFolder(currentPath)
        .then((res) => {
          if (res.success && res.data) {
            setItems(res.data.items);
            setStatus("ready");
          } else {
            setErrorMsg(res.error?.message || "Error desconocido");
            setStatus("error");
          }
        })
        .catch(() => {
          setErrorMsg("No se pudo conectar con el backend.");
          setStatus("error");
        });
    }
  }, [currentPath]);

  function openDrive(letter: string) {
    setCurrentPath(`${letter}/`);
  }

  function openFolder(name: string) {
    setCurrentPath(
      `${currentPath}${currentPath?.endsWith("/") ? "" : "/"}${name}`,
    );
  }

  // Breadcrumb: "Este equipo" siempre primero, seguido de los segmentos de la ruta actual
  const segments = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setCurrentPath(null)}
              className={
                currentPath === null
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }
              disabled={currentPath === null}
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
                    onClick={() => setCurrentPath(pathUpToHere)}
                    className={
                      isLast
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }
                    disabled={isLast}
                  >
                    {seg}
                  </button>
                </span>
              );
            })}
          </div>

          {currentPath !== null && (
            <div className="flex gap-3">
              <button
                onClick={() => setModalOpen("folder")}
                className="bg-accent px-4 py-2.5 rounded-lg text-sm font-medium"
              >
                + Carpeta
              </button>
              <button
                onClick={() => setModalOpen("file")}
                className="bg-accent px-4 py-2.5 rounded-lg text-sm font-medium"
              >
                + Archivo
              </button>
            </div>
          )}
        </header>

        {status === "loading" && (
          <span className="text-text-secondary text-sm">Cargando...</span>
        )}
        {status === "error" && (
          <span className="text-red-400 text-sm">{errorMsg}</span>
        )}

        {/* Vista raíz: tarjetas de unidades */}
        {status === "ready" && currentPath === null && (
          <div className="flex gap-6 flex-wrap">
            {drives.map((d) => (
              <div
                key={d.letter}
                onClick={() => openDrive(d.letter)}
                className="bg-surface rounded-2xl p-6 flex flex-col gap-2 w-56 cursor-pointer hover:bg-white/5"
              >
                <ChipIcon className="w-6 h-6 text-accent" />
                <span className="text-lg font-bold">Unidad {d.letter}</span>
                <span className="text-xs text-text-secondary">
                  {formatGB(d.total_bytes)} · {d.filesystem}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Vista de carpeta: tabla de contenido */}
        {status === "ready" && currentPath !== null && (
          <div className="flex flex-col gap-1">
            <div className="flex px-5 py-2 text-xs font-medium text-text-secondary">
              <span className="flex-2">Nombre</span>
              <span className="flex-1">Tipo</span>
              <span className="flex-1">Tamaño</span>
              <span className="flex-1">Modificado</span>
            </div>

            {items.length === 0 && (
              <span className="text-text-secondary text-sm px-5 py-4">
                Esta carpeta está vacía.
              </span>
            )}

            {items.map((item) => (
              <div
                key={item.name}
                onClick={() => item.type === "folder" && openFolder(item.name)}
                className={`flex items-center bg-surface rounded-lg px-5 py-3.5 ${
                  item.type === "folder"
                    ? "cursor-pointer hover:bg-white/5"
                    : ""
                }`}
              >
                <span className="flex-2 flex items-center gap-2 font-medium">
                  {item.type === "folder" && (
                    <FolderIcon className="w-4 h-4 text-accent shrink-0" />
                  )}
                  {item.name}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {item.type === "folder"
                    ? "Carpeta"
                    : item.detected_type?.category || "Desconocido"}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {formatGB(item.size_bytes)}
                </span>
                <span className="flex-1 text-sm text-text-secondary">
                  {formatDate(item.modified_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {modalOpen && currentPath !== null && (
        <CreateItemModal
          type={modalOpen}
          currentPath={currentPath}
          onClose={() => setModalOpen(null)}
          onCreated={reloadFolder}
          createFn={
            modalOpen === "folder" ? createFolder : (p, n) => createFile(p, n)
          }
        />
      )}
    </div>
  );
}
