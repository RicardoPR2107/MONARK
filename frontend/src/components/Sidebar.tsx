// src/components/Sidebar.tsx
// Barra de navegación lateral plegable. A diferencia de Figma (donde tuvimos
// que simular el plegado con dos frames + Smart Animate), aquí es un
// comportamiento real: un solo componente con estado, que anima su propio ancho.

import { useState } from "react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import {
  HomeIcon,
  FolderIcon,
  ChipIcon,
  SignalIcon,
  TrashIcon,
  MenuIcon,
} from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Inicio", icon: HomeIcon },
  { to: "/archivos", label: "Archivos", icon: FolderIcon },
  { to: "/hardware", label: "Hardware", icon: ChipIcon },
  { to: "/red", label: "Red", icon: SignalIcon },
  { to: "/papelera", label: "Papelera", icon: TrashIcon }, // al final, como definimos
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.aside
      animate={{ width: expanded ? 240 : 72 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-screen bg-surface flex flex-col py-5 px-3 shrink-0 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="p-2.5 rounded-lg text-text-secondary hover:bg-white/5 self-start mb-4"
      >
        <MenuIcon />
      </button>

      <nav className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-accent text-text-primary"
                  : "text-text-secondary hover:bg-white/5"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {expanded && (
              <span className="text-sm font-medium whitespace-nowrap">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
}
