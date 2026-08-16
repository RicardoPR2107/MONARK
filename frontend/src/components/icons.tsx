// src/components/icons.tsx
// Íconos SVG simples, reutilizables en toda la app. Mismo estilo geométrico
// básico que usamos en los mockups de Figma — se pueden refinar más adelante
// sin tocar el resto del código, ya que cada uno es un componente aislado.

interface IconProps {
  className?: string;
}

export function HomeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 2 L18 9 L16 9 L16 17 L4 17 L4 9 L2 9 Z" />
    </svg>
  );
}

export function FolderIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <rect x="2" y="6" width="16" height="11" rx="2" />
      <rect x="2" y="4" width="8" height="3" rx="1" />
    </svg>
  );
}

export function ChipIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <rect
        x="8"
        y="8"
        width="4"
        height="4"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function SignalIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <rect x="2" y="13" width="3" height="5" rx="1" />
      <rect x="8" y="9" width="3" height="9" rx="1" />
      <rect x="14" y="4" width="3" height="14" rx="1" />
    </svg>
  );
}

export function TrashIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="4" y="6" width="12" height="12" rx="1" />
      <rect
        x="3"
        y="4"
        width="14"
        height="2"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="7"
        y="1.5"
        width="6"
        height="2"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function MenuIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <rect x="2" y="4" width="16" height="2" rx="1" />
      <rect x="2" y="9" width="16" height="2" rx="1" />
      <rect x="2" y="14" width="16" height="2" rx="1" />
    </svg>
  );
}
