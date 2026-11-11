
import { Bell, LogOut, Search } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { clearAuthSession } from "../services/authSession";

const pageTitles: Record<string, string> = {
    "/": "Dashboard",
    "/proyectos": "Gestión de proyectos",
    "/actividades": "Actividades de obra",
    "/presupuestos": "Presupuestos",
    "/recursos": "Recursos y precios",
    "/configuracion": "Configuración",
    "/usuarios": "Gestión de usuarios",
};

export default function DashboardLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const title = pageTitles[pathname] ?? "ObraControl";

    function handleLogout() {
        clearAuthSession();
        navigate("/login", { replace: true });
    }

    return (
        <div className="app-shell">
            <Sidebar />

            <main className="main-area">
                <header className="topbar">
                    <div className="breadcrumb">
                        Sistema de presupuestos <span>/</span> {title}
                    </div>

                    <div className="topbar-actions">
                        <button className="icon-button" aria-label="Buscar">
                            <Search size={20} />
                        </button>
                        <button className="icon-button" aria-label="Notificaciones">
                            <Bell size={20} />
                        </button>
                        <button
                            className="icon-button"
                            type="button"
                            aria-label="Cerrar sesión"
                            title="Cerrar sesión"
                            onClick={handleLogout}
                        >
                            <LogOut size={19} />
                        </button>
                        <div className="topbar-user">AD</div>
                    </div>
                </header>

                <section className="page-content">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}
