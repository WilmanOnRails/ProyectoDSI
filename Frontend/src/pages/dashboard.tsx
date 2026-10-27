
import {
    FolderKanban,
    FileSpreadsheet,
    ClipboardList,
    ArrowUpRight,
    Plus,
    Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
    {
        label: "Proyectos registrados",
        value: "12",
        detail: "Proyectos de construcción",
        icon: FolderKanban,
    },
    {
        label: "Presupuestos creados",
        value: "08",
        detail: "Presupuestos elaborados",
        icon: FileSpreadsheet,
    },
    {
        label: "Actividades registradas",
        value: "124",
        detail: "Actividades de obra",
        icon: ClipboardList,
    },
];

const projects = [
    { code: "PRO-001", name: "Construcción de vivienda", date: "20 oct. 2026", status: "En proceso" },
    { code: "PRO-002", name: "Remodelación de oficinas", date: "18 oct. 2026", status: "Pendiente" },
    { code: "PRO-003", name: "Ampliación de local comercial", date: "15 oct. 2026", status: "Finalizado" },
];

export default function Dashboard() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">VISTA GENERAL</p>
                    <h1>Bienvenido a ObraControl</h1>
                    <p className="muted">
                        Administrá tus proyectos y elaborá presupuestos de construcción.
                    </p>
                </div>

                <Link to="/proyectos" className="primary-button">
                    <Plus size={18} /> Nuevo proyecto
                </Link>
            </div>

            <div className="stats-grid">
                {stats.map(({ label, value, detail, icon: Icon }) => (
                    <article className="stat-card" key={label}>
                        <div className="stat-top">
                            <span>{label}</span>
                            <div className="stat-icon"><Icon size={21} /></div>
                        </div>
                        <strong className="stat-value">{value}</strong>
                        <span className="stat-detail">{detail}</span>
                    </article>
                ))}
            </div>

            <div className="dashboard-grid">
                <section className="panel recent-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Proyectos recientes</h2>
                            <p>Resumen de tus últimos proyectos</p>
                        </div>
                        <Link to="/proyectos" className="text-link">
                            Ver todos <ArrowUpRight size={16} />
                        </Link>
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Proyecto</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((project) => (
                                    <tr key={project.code}>
                                        <td className="code-cell">{project.code}</td>
                                        <td>{project.name}</td>
                                        <td>{project.date}</td>
                                        <td>
                                            <span
                                                className={`status status-${project.status.toLowerCase().replace(" ", "-")}`}
                                            >
                                                {project.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="panel shortcuts-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Accesos rápidos</h2>
                            <p>Continuá con tu trabajo</p>
                        </div>
                    </div>

                    <Link to="/proyectos" className="shortcut">
                        <div className="shortcut-icon blue"><Plus size={20} /></div>
                        <div>
                            <strong>Crear proyecto</strong>
                            <span>Registrá una nueva obra</span>
                        </div>
                        <ArrowUpRight size={17} />
                    </Link>

                    <Link to="/actividades" className="shortcut">
                        <div className="shortcut-icon purple"><Upload size={20} /></div>
                        <div>
                            <strong>Gestionar actividades</strong>
                            <span>Revisá las partidas de obra</span>
                        </div>
                        <ArrowUpRight size={17} />
                    </Link>

                    <Link to="/presupuestos" className="shortcut">
                        <div className="shortcut-icon orange">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <strong>Elaborar presupuesto</strong>
                            <span>Prepará un nuevo presupuesto</span>
                        </div>
                        <ArrowUpRight size={17} />
                    </Link>
                </section>
            </div>

            <p className="demo-notice">
                Vista preliminar: los indicadores y proyectos mostrados son datos de ejemplo.
            </p>
        </>
    );
}
