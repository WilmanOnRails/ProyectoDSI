import { useEffect, useState } from "react";
import { FolderKanban, FileSpreadsheet, ClipboardList, ArrowUpRight, Plus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";

type DashboardCounts = {
  proyectos: number;
  presupuestos: number;
  actividades: number;
};

export default function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts>({
    proyectos: 0,
    presupuestos: 0,
    actividades: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<DashboardCounts>("/dashboard/resumen")
      .then((result) => {
        setCounts(result);
        setError("");
      })
      .catch(() => setError("No se pudieron cargar los datos del dashboard."));
  }, []);

  const stats = [
    {
      label: "Proyectos registrados",
      value: counts.proyectos,
      detail: "Proyectos de construcción",
      icon: FolderKanban,
    },
    {
      label: "Presupuestos creados",
      value: counts.presupuestos,
      detail: "Presupuestos elaborados",
      icon: FileSpreadsheet,
    },
    {
      label: "Actividades registradas",
      value: counts.actividades,
      detail: "Actividades de obra",
      icon: ClipboardList,
    },
  ];

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
              <div className="stat-icon">
                <Icon size={21} />
              </div>
            </div>
            <strong className="stat-value">{value}</strong>
            <span className="stat-detail">{detail}</span>
          </article>
        ))}
      </div>
      {error && <div className="import-error">{error}</div>}
      <div className="dashboard-grid">
        <section className="panel shortcuts-panel">
          <div className="panel-heading">
            <div>
              <h2>Accesos rápidos</h2>
              <p>Continuá con tu trabajo</p>
            </div>
          </div>
          <Link to="/proyectos" className="shortcut">
            <div className="shortcut-icon blue">
              <Plus size={20} />
            </div>
            <div>
              <strong>Importar proyecto</strong>
              <span>Cargá un pliego PDF</span>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          <Link to="/actividades" className="shortcut">
            <div className="shortcut-icon purple">
              <Upload size={20} />
            </div>
            <div>
              <strong>Ver actividades</strong>
              <span>Revisá las partidas de obra</span>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          <Link to="/presupuestos" className="shortcut">
            <div className="shortcut-icon orange">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <strong>Ver presupuestos</strong>
              <span>Consultá los costos</span>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
