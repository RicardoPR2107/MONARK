// src/components/ConfirmModal.tsx
// Modal de confirmación genérico — reutilizable para cualquier acción que
// necesite un "¿estás seguro?" antes de ejecutarse (eliminar, sobrescribir, etc.)

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  danger,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl p-6 w-96 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{message}</p>
        <div className="flex justify-end gap-3 mt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-text-primary ${
              danger ? "bg-red-500/90 hover:bg-red-500" : "bg-accent"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
