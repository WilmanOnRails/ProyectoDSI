
import {
    LayoutDashboard,
    FolderKanban,
    ClipboardList,
    FileSpreadsheet,
    Package,
    Settings,
    HardHat,
    UserRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { apiGet } from "../services/api";
import { getAuthSession } from "../services/authSession";

const navigation = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Proyectos", path: "/proyectos", icon: FolderKanban },
    { label: "Actividades", path: "/actividades", icon: ClipboardList },
    { label: "Presupuestos", path: "/presupuestos", icon: FileSpreadsheet },
    { label: "Recursos y precios", path: "/recursos", icon: Package },
];

const preloadPage: Record<string, () => Promise<unknown>> = {
    "/": () => import("../pages/dashboard.tsx"),
    "/proyectos": () => import("../pages/Projects.tsx"),
    "/actividades": () => import("../pages/Activities.tsx"),
    "/presupuestos": () => import("../pages/Budgets"),
    "/recursos": () => import("../pages/Resources.tsx"),
    "/configuracion": () => import("../pages/SettingsPage.tsx"),
    "/usuarios": () => import("../pages/Users.tsx"),
};

const rutasPrecargadas = new Set<string>();

function precargarPagina(path: string) {
    if (rutasPrecargadas.has(path)) {
        return;
    }

    rutasPrecargadas.add(path);

    const preload = preloadPage[path];
    if (!preload) return;

    void preload().catch((error: unknown) => {
        console.error(`No se pudo precargar la página ${path}.`, error);
        rutasPrecargadas.delete(path);
    });

    const requests: Promise<unknown>[] = [];
    if (path === "/") {
        requests.push(apiGet("/dashboard/resumen"));
    } else if (path === "/actividades") {
        requests.push(
            apiGet("/activities", { pagina: 1, limite: 50 }),
            apiGet("/projects"),
        );
    }

    if (requests.length === 0) {
        return;
    }

    void Promise.all(requests).catch((error: unknown) => {
        console.error(`No se pudieron precargar los datos de ${path}.`, error);
        rutasPrecargadas.delete(path);
    });
}

export default function Sidebar() {
    const isAdmin = getAuthSession()?.user.rol === "administrador";
    const menuItems = isAdmin
        ? [...navigation, { label: "Usuarios", path: "/usuarios", icon: UserRound }]
        : navigation;

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-icon">
                    <HardHat size={25} />
                </div>
                <div>
                    <h2>ObraControl</h2>
                    <span>Gestión de presupuestos</span>
                </div>
            </div>

            <p className="menu-label">MENÚ PRINCIPAL</p>

            <nav className="navigation">
                {menuItems.map(({ label, path, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        end={path === "/"}
                        onMouseEnter={() => precargarPagina(path)}
                        onFocus={() => precargarPagina(path)}
                        className={({ isActive }) =>
                            `nav-link ${isActive ? "active" : ""}`
                        }
                    >
                        <Icon size={19} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-bottom">
                <NavLink
                    to="/configuracion"
                    onMouseEnter={() => precargarPagina("/configuracion")}
                    onFocus={() => precargarPagina("/configuracion")}
                    className="nav-link"
                >
                    <Settings size={19} />
                    <span>Configuración</span>
                </NavLink>

                <div className="profile">
                    <div className="avatar">AD</div>
                    <div>
                        <strong>Administrador</strong>
                        <span>Panel de gestión</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
