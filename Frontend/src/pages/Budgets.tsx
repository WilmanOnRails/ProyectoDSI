import { useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import api from "../services/api";

type Item = {
  id: string;
  cantidadProyecto: string | number;
  costoUnitarioCongelado: string | number;
  total: string | number;
  actividad: {
    codigo: string;
    nombre: string;
    unidad: string;
    capituloCodigo?: string;
    capituloNombre?: string;
  };
};

type Budget = {
  id: string;
  nombre?: string;
  numero?: string;
  total: string | number;
  costosDirectos: string | number;
  indirectos: string | number;
  utilidad: string | number;
  imprevistos: string | number;
  subtotalNeto: string | number;
  impuestos: string | number;
  proyecto?: { nombre: string; cliente?: string; ubicacion?: string };
  items?: Item[];
};

const money = (v: string | number) =>
  `C$ ${Number(v || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Budgets() {
  const [items, setItems] = useState<Budget[]>([]);
  const [selected, setSelected] = useState<Budget | null>(null);
  const [error, setError] = useState("");

  const loadBudgets = () => {
    api
      .get<Budget[]>("/presupuestos")
      .then((r) => setItems(r.data))
      .catch(() => setError("No se pudieron cargar los presupuestos."));
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const open = async (id: string) => {
    try {
      const res = await api.get<Budget>(`/presupuestos/${id}`);
      setSelected(res.data);
      setError("");
    } catch {
      setError("No se pudo cargar el detalle del presupuesto.");
    }
  };

  const exportExcel = async (id: string) => {
    try {
      const res = await api.get(`/presupuestos/${id}/excel`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `presupuesto-${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("No se pudo exportar el archivo Excel.");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONTROL DE COSTOS</p>
          <h1>Presupuestos</h1>
          <p className="muted">Presupuestos calculados automáticamente con sus totales, partidas y capítulos.</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Presupuestos registrados ({items.length})</h2>
            <p>{error || "Totales sincronizados automáticamente desde los APUs del sistema."}</p>
          </div>
          <FileSpreadsheet size={28} />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proyecto</th>
                <th>Actividades</th>
                <th>Total General</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>{x.nombre || "Sin nombre"}</td>
                  <td>{x.proyecto?.nombre || "—"}</td>
                  <td>{x.items?.length || 0}</td>
                  <td><strong>{money(x.total)}</strong></td>
                  <td>
                    <button className="text-link" onClick={() => void open(x.id)}>
                      Ver desglose
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5}>No hay presupuestos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="panel data-panel budget-detail">
          <div className="panel-heading">
            <div>
              <h2>{selected.nombre}</h2>
              <p>{selected.proyecto?.nombre} · {selected.proyecto?.ubicacion || "Ubicación no indicada"}</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                className="primary-button"
                onClick={() => void exportExcel(selected.id)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={16} /> Exportar Excel
              </button>
              <button className="secondary-button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </div>

          {error && <div className="import-error">{error}</div>}

          <div className="table-wrapper" style={{ marginTop: "14px" }}>
            <table>
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Capítulo</th>
                  <th>Descripción</th>
                  <th>U.M.</th>
                  <th>Cantidad</th>
                  <th>P.U. Unitario</th>
                  <th>Importe Total</th>
                </tr>
              </thead>
              <tbody>
                {(selected.items || []).map((x, i) => (
                  <tr key={x.id}>
                    <td className="code-cell">{x.actividad.codigo || String(i + 1)}</td>
                    <td>{x.actividad.capituloNombre || x.actividad.capituloCodigo || "General"}</td>
                    <td className="truncate-cell" title={x.actividad.nombre}>{x.actividad.nombre}</td>
                    <td>{x.actividad.unidad}</td>
                    <td>{x.cantidadProyecto}</td>
                    <td>{money(x.costoUnitarioCongelado)}</td>
                    <td><strong>{money(x.total)}</strong></td>
                  </tr>
                ))}
                {!selected.items?.length && (
                  <tr>
                    <td colSpan={7}>Este presupuesto no tiene ítems asociados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="financial-summary">
            <p>Costo directo: <strong>{money(selected.costosDirectos)}</strong></p>
            <p>Indirectos: <strong>{money(selected.indirectos)}</strong></p>
            <p>Utilidad: <strong>{money(selected.utilidad)}</strong></p>
            <p>Imprevistos: <strong>{money(selected.imprevistos)}</strong></p>
            <p>Subtotal neto: <strong>{money(selected.subtotalNeto)}</strong></p>
            <p>Impuestos: <strong>{money(selected.impuestos)}</strong></p>
            <p className="total-line">Precio total: <strong>{money(selected.total)}</strong></p>
          </div>
        </section>
      )}
    </>
  );
}
