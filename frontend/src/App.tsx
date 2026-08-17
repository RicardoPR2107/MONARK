// src/App.tsx

import { HashRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Archivos from "./pages/Archivos";
import Hardware from "./pages/Hardware";
import Red from "./pages/Red";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/archivos" element={<Archivos />} />
        <Route path="/hardware" element={<Hardware />} />
        <Route path="/red" element={<Red />} />
        {/* Próxima ruta: /papelera */}
      </Routes>
    </HashRouter>
  );
}

export default App;
