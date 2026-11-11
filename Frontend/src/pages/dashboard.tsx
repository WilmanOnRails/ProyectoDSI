import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  HardHat,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";

type DashboardData = {
  proyectos: number;
  presupuestos: number;
  actividades: number;
  enElaboracion: number;
  finalizados: number;
  valorPresupuestado: string;
  presupuestosPorProyecto: Array<{
    proyectoId: string;
    nombre: string;
    total: string;
  }>;
  distribucionCostos: Array<{
    tipo: string;
    valor: string;
  }>;
  ultimasActualizaciones: Array<{
    id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    precio: string;
    fecha: string;
  }>;
};

const COST_COLORS = ["#3268e8", "#43b69b", "#f0b43a", "#8b65dc"];
const CURRENCY_FORMATTER = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const COMPACT_FORMATTER = new Intl.NumberFormat("es-NI", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCurrency(value: string | number) {
  return CURRENCY_FORMATTER.format(Number(value) || 0);
}

function formatCompactCurrency(value: number) {
  return `C$${COMPACT_FORMATTER.format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ProjectBudgetChart({
  projects,
}: {
  projects: DashboardData["presupuestosPorProyecto"];
}) {
  const maxValue = Math.max(...projects.map((project) => Number(project.total)), 1);
  const chartHeight = 178;
  const chartTop = 18;
  const chartBottom = chartTop + chartHeight;
  const chartWidth = 720;
  const left = 58;
  const right = 18;
  const plotWidth = chartWidth - left - right;

  return (
    <div className="dashboard-chart-scroll">
      <svg
        className="dashboard-bar-chart"
        viewBox={`0 0 ${chartWidth} 252`}
        role="img"
        aria-label="Valor presupuestado por proyecto"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = chartBottom - step * chartHeight;
          return (
            <g key={step}>
              <line
                x1={left}
                x2={chartWidth - right}
                y1={y}
                y2={y}
                className="dashboard-chart-gridline"
              />
              <text x={left - 10} y={y + 4} textAnchor="end" className="dashboard-axis-label">
                {formatCompactCurrency(maxValue * step)}
              </text>
            </g>
          );
        })}
        {projects.map((project, index) => {
          const slotWidth = plotWidth / Math.max(projects.length, 1);
          const barWidth = Math.min(46, slotWidth * 0.42);
          const value = Number(project.total) || 0;
          const height = Math.max((value / maxValue) * chartHeight, value > 0 ? 3 : 0);
          const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
          const y = chartBottom - height;
          const label =
            project.nombre.length > 14
              ? `${project.nombre.slice(0, 12)}…`
              : project.nombre;
          return (
            <g key={project.proyectoId}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="7"
                className="dashboard-chart-bar"
              >
                <title>{`${project.nombre}: ${formatCurrency(value)}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={chartBottom + 23}
                textAnchor="middle"
                className="dashboard-axis-label dashboard-project-label"
              >
                <title>{project.nombre}</title>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CostDonut({
  items,
}: {
  items: DashboardData["distribucionCostos"];
}) {
  const total = items.reduce((sum, item) => sum + Number(item.valor), 0);
  const circumference = 2 * Math.PI * 58;
  const segments = items.map((item, index) => {
    const value = Number(item.valor) || 0;
    const length = total > 0 ? (value / total) * circumference : 0;
    const offset = items
      .slice(0, index)
      .reduce(
        (sum, previous) =>
          sum +
          (total > 0
            ? ((Number(previous.valor) || 0) / total) * circumference
            : 0),
        0,
      );
    return { item, index, value, length, offset };
  });

  return (
    <div className="dashboard-donut-layout">
      <div className="dashboard-donut-wrap">
        <svg
          viewBox="0 0 160 160"
          className="dashboard-donut"
          role="img"
          aria-label="Distribución de costos directos por categoría"
        >
          <circle
            cx="80"
            cy="80"
            r="58"
            className="dashboard-donut-track"
            strokeWidth="19"
            fill="none"
          />
          {segments.map(({ item, index, value, length, offset }) => {
            if (length <= 0) return null;
            return (
              <circle
                key={item.tipo}
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke={COST_COLORS[index % COST_COLORS.length]}
                strokeWidth="19"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                className="dashboard-donut-segment"
              >
                <title>{`${item.tipo}: ${formatCurrency(value)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="dashboard-donut-center">
          <span>COSTO DIRECTO</span>
          <strong>{formatCompactCurrency(total)}</strong>
        </div>
      </div>
      <div className="dashboard-legend">
        {items.map((item, index) => {
          const value = Number(item.valor) || 0;
          const percent = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div className="dashboard-legend-row" key={item.tipo}>
              <span
                className="dashboard-legend-dot"
                style={{ backgroundColor: COST_COLORS[index % COST_COLORS.length] }}
              />
              <span className="dashboard-legend-name">{item.tipo}</span>
              <strong>{percent}%</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<DashboardData>("/dashboard/resumen")
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los datos del dashboard.");
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () =>
      data
        ? [
            {
              label: "Proyectos totales",
              value: data.proyectos,
              detail: "En toda la plataforma",
              icon: FolderKanban,
              tone: "amber",
              to: "/proyectos",
            },
            {
              label: "En elaboración",
              value: data.enElaboracion,
              detail: "Proyectos en progreso",
              icon: HardHat,
              tone: "violet",
              to: "/proyectos",
            },
            {
              label: "Finalizados",
              value: data.finalizados,
              detail: "Proyectos completados",
              icon: CheckCircle2,
              tone: "green",
              to: "/proyectos",
            },
            {
              label: "Valor presupuestado",
              value: formatCurrency(data.valorPresupuestado),
              detail: `${data.presupuestos} presupuestos`,
              icon: Wallet,
              tone: "blue",
              to: "/presupuestos",
            },
          ]
        : [],
    [data],
  );

  const hasCosts = data?.distribucionCostos.some(
    (item) => Number(item.valor) > 0,
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-welcome">
        <div>
          <p className="eyebrow">PANEL DE CONTROL</p>
          <h1>Resumen de obra</h1>
          <p className="muted">
            Una vista clara de tus proyectos, presupuestos y costos.
          </p>
          {data && (
            <span className="dashboard-activity-note">
              <ClipboardList size={15} />
              {data.actividades} actividades registradas
            </span>
          )}
        </div>
        <Link to="/proyectos" className="primary-button">
          <FolderKanban size={17} /> Ver proyectos
        </Link>
      </header>

      {error && <div className="import-error">{error}</div>}

      <section className="dashboard-kpis" aria-label="Indicadores principales">
        {data
          ? stats.map(({ label, value, detail, icon: Icon, tone, to }) => (
              <article className="dashboard-kpi-card" key={label}>
                <div className={`dashboard-kpi-icon ${tone}`}>
                  <Icon size={20} />
                </div>
                <div className="dashboard-kpi-content">
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <Link to={to}>
                    {detail} <ArrowUpRight size={13} />
                  </Link>
                </div>
              </article>
            ))
          : !error &&
            Array.from({ length: 4 }, (_, index) => (
              <div className="dashboard-kpi-skeleton" key={index} />
            ))}
      </section>

      <section className="dashboard-visuals">
        <article className="dashboard-panel dashboard-projects-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="eyebrow">RESUMEN FINANCIERO</p>
              <h2>Presupuestos por proyecto</h2>
              <p>Los cinco proyectos con mayor valor presupuestado.</p>
            </div>
            <Link to="/presupuestos" className="dashboard-panel-link">
              Ver presupuestos <ArrowUpRight size={15} />
            </Link>
          </div>
          {data?.presupuestosPorProyecto.length ? (
            <ProjectBudgetChart projects={data.presupuestosPorProyecto} />
          ) : data ? (
            <div className="dashboard-chart-empty">
              <FileText size={23} />
              <span>Aún no hay presupuestos para mostrar.</span>
            </div>
          ) : (
            <div className="dashboard-chart-skeleton" />
          )}
        </article>

        <article className="dashboard-panel dashboard-costs-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="eyebrow">COMPOSICIÓN</p>
              <h2>Distribución de costos</h2>
              <p>Costos directos de todos los presupuestos.</p>
            </div>
          </div>
          {data && hasCosts ? (
            <CostDonut items={data.distribucionCostos} />
          ) : data ? (
            <div className="dashboard-chart-empty">
              <Wallet size={23} />
              <span>Los costos aparecerán al crear presupuestos.</span>
            </div>
          ) : (
            <div className="dashboard-donut-skeleton" />
          )}
        </article>
      </section>

      <section className="dashboard-panel dashboard-prices-panel">
        <div className="dashboard-panel-heading">
          <div>
            <p className="eyebrow">CATÁLOGO DE RECURSOS</p>
            <h2>Últimas actualizaciones de precios</h2>
            <p>Movimientos recientes en materiales, equipos y mano de obra.</p>
          </div>
          <Link to="/recursos" className="dashboard-panel-link">
            Ver catálogo <ArrowUpRight size={15} />
          </Link>
        </div>
        {data?.ultimasActualizaciones.length ? (
          <div className="dashboard-price-list">
            {data.ultimasActualizaciones.map((item) => (
              <div className="dashboard-price-row" key={item.id}>
                <div className="dashboard-price-resource">
                  <span className="dashboard-price-code">{item.codigo}</span>
                  <strong>{item.descripcion}</strong>
                  <span>Por {item.unidad.toLocaleLowerCase("es")}</span>
                </div>
                <strong className="dashboard-price-value">
                  {formatCurrency(item.precio)}
                </strong>
                <time dateTime={item.fecha}>{formatDate(item.fecha)}</time>
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="dashboard-price-empty">
            Aún no hay actualizaciones de precios registradas.
          </div>
        ) : (
          <div className="dashboard-prices-skeleton" />
        )}
      </section>
    </div>
  );
}
