
import {
    LayoutDashboard,
    FolderKanban,
    ClipboardList,
    FileSpreadsheet,
    Package,
    Settings,
    HardHat,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Proyectos", path: "/proyectos", icon: FolderKanban },
    { label: "Actividades", path: "/actividades", icon: ClipboardList },
    { label: "Presupuestos", path: "/presupuestos", icon: FileSpreadsheet },
    { label: "Recursos y precios", path: "/recursos", icon: Package },
];

export default function Sidebar() {
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
                {navigation.map(({ label, path, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        end={path === "/"}
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
                <NavLink to="/configuracion" className="nav-link">
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
