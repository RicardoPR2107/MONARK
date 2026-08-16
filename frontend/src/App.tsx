// src/App.tsx

import { HashRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Archivos from "./pages/Archivos";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/archivos" element={<Archivos />} />
        {/* Próximas rutas: /hardware, /red, /papelera */}
      </Routes>
    </HashRouter>
  );
}

export default App;
