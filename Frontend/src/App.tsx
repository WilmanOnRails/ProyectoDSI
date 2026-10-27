
import { BrowserRouter, Route, Routes } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout.tsx";
import Dashboard from "./pages/dashboard.tsx";
import Projects from "./pages/Projects.tsx";
import Activities from "./pages/Activities.tsx";
import Budgets from "./pages/Budgets";
import Resources from "./pages/Resources.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/proyectos" element={<Projects />} />
          <Route path="/actividades" element={<Activities />} />
          <Route path="/presupuestos" element={<Budgets />} />
          <Route path="/recursos" element={<Resources />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
