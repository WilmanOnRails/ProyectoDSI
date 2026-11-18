
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Notifications from "../components/Notifications";
import {
    AUTH_SESSION_EVENT,
    clearAuthSession,
    getAuthSession,
    getRefreshToken,
    getUserInitials,
} from "../services/authSession";
import { logout } from "../services/auth";

const pageTitles: Record<string, string> = {
    "/": "Dashboard",
    "/proyectos": "Gestión de proyectos",
    "/actividades": "Actividades de obra",
    "/presupuestos": "Presupuestos",
    "/recursos": "Recursos y precios",
    "/reportes": "Reportes",
    "/configuracion": "Configuración",
    "/usuarios": "Gestión de usuarios",
};

export default function DashboardLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const title = pageTitles[pathname] ?? "ObraControl";
    const [session, setSession] = useState(getAuthSession);

    useEffect(() => {
        const refreshSession = () => setSession(getAuthSession());
        window.addEventListener(AUTH_SESSION_EVENT, refreshSession);
        return () => window.removeEventListener(AUTH_SESSION_EVENT, refreshSession);
    }, []);

    async function handleLogout() {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            try {
                await logout(refreshToken);
            } catch {
                // Igual cerramos la sesión local si el servidor no responde.
            }
        }
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
                        <Notifications />
                        <button
                            className="icon-button"
                            type="button"
                            aria-label="Cerrar sesión"
                            title="Cerrar sesión"
                            onClick={handleLogout}
                        >
                            <LogOut size={19} />
                        </button>
                        <div className="topbar-user">
                            {getUserInitials(session?.user.nombre ?? "")}
                        </div>
                    </div>
                </header>

                <section className="page-content">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}
