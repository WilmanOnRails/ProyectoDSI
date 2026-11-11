
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import DashboardLayout from "./layouts/DashboardLayout.tsx";

const Login = lazy(() => import("./pages/Login.tsx"));
const PasswordRecovery = lazy(() => import("./pages/PasswordRecovery.tsx"));
const Dashboard = lazy(() => import("./pages/dashboard.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const Activities = lazy(() => import("./pages/Activities.tsx"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Resources = lazy(() => import("./pages/Resources.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const Users = lazy(() => import("./pages/Users.tsx"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status">Cargando página...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-contrasena" element={<PasswordRecovery />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/proyectos" element={<Projects />} />
            <Route path="/actividades" element={<Activities />} />
            <Route path="/presupuestos" element={<Budgets />} />
            <Route path="/recursos" element={<Resources />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="/usuarios" element={<Users />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
