import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import api from "../services/api";

type Activity = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  capituloNombre?: string;
};

type Resource = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  tipo: string;
  precioActual: string | number;
};

type ApuDetalle = {
  id: string;
  recursoId: string;
  cantidadPorUnidad: string | number;
  recurso: Resource;
};

type ApuCache = {
  costoMateriales: string | number;
  costoManoObra: string | number;
  costoEquipo: string | number;
  costoTransporte: string | number;
  costoTotal: string | number;
};

type ActivityApuData = Activity & {
  apuDetalles?: ApuDetalle[];
  apuCostoCache?: ApuCache;
};

const money = (v: string | number) =>
  `C$ ${Number(v || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Activities() {
  const [items, setItems] = useState<Activity[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<ActivityApuData | null>(null);
  const [recursoId, setRecursoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const loadActivities = () => {
    api
      .get<Activity[]>("/activities")
      .then((r) => setItems(r.data))
      .catch(() => setError("No se pudieron cargar las actividades."));
  };

  const loadResources = () => {
    api
      .get<Resource[]>("/recursos")
      .then((r) => setResources(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    loadActivities();
    loadResources();
  }, []);

  const openApu = async (id: string) => {
    try {
      const res = await api.get<ActivityApuData>(`/apus/actividad/${id}`);
      setSelected(res.data);
      setError("");
      setMensaje("");
    } catch {
      setError("No se pudo cargar el APU de la actividad.");
    }
  };

  const addApuItem = async () => {
    if (!selected || !recursoId) return;
    try {
      await api.post("/apus", {
        actividadId: selected.id,
        recursoId,
        cantidadPorUnidad: Number(cantidad),
      });
      setMensaje("Recurso agregado al APU correctamente.");
      setRecursoId("");
      setCantidad("1");
      await openApu(selected.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "No se pudo agregar el recurso al APU.");
    }
  };

  const removeApuItem = async (apuId: string) => {
    if (!selected) return;
    try {
      await api.delete(`/apus/${apuId}`);
      setMensaje("Recurso eliminado del APU.");
      await openApu(selected.id);
    } catch {
      setError("No se pudo eliminar el recurso del APU.");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGO DE OBRA</p>
          <h1>Actividades y APU</h1>
          <p className="muted">Análisis de precios unitarios por actividad usando recursos SINSA.</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Actividades registradas ({items.length})</h2>
            <p>{error || "Seleccioná una actividad para configurar su APU."}</p>
          </div>
          <ClipboardList size={28} />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Capítulo</th>
                <th>Descripción</th>
                <th>U.M.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td className="code-cell">{x.codigo}</td>
                  <td>{x.capituloNombre || "—"}</td>
                  <td>{x.nombre}</td>
                  <td>{x.unidad}</td>
                  <td>
                    <button className="text-link" onClick={() => void openApu(x.id)}>
                      Configurar APU
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5}>No hay actividades registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="panel data-panel apu-detail-panel">
          <div className="panel-heading">
            <div>
              <h2>APU: {selected.codigo} - {selected.nombre}</h2>
              <p>Unidad de medida: <strong>{selected.unidad}</strong></p>
            </div>
            <button className="secondary-button" onClick={() => setSelected(null)}>
              Cerrar APU
            </button>
          </div>

          <div className="apu-form-grid">
            <label>
              Recurso SINSA / Catálogo
              <select className="text-input" value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
                <option value="">Seleccionar recurso...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.tipo.toUpperCase()}] {r.codigo} - {r.nombre} ({r.unidad}) — {money(r.precioActual)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad por unidad
              <input
                className="text-input"
                type="number"
                step="0.0001"
                min="0.0001"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <button className="primary-button add-apu-btn" onClick={() => void addApuItem()}>
              <Plus size={16} /> Agregar al APU
            </button>
          </div>

          {mensaje && <div className="import-success">{mensaje}</div>}
          {error && <div className="import-error">{error}</div>}

          <div className="table-wrapper" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Recurso</th>
                  <th>U.M.</th>
                  <th>Cantidad / Unidad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(selected.apuDetalles || []).map((det) => {
                  const subtotal = Number(det.cantidadPorUnidad) * Number(det.recurso.precioActual);
                  return (
                    <tr key={det.id}>
                      <td><span className="badge">{det.recurso.tipo}</span></td>
                      <td className="code-cell">{det.recurso.codigo}</td>
                      <td>{det.recurso.nombre}</td>
                      <td>{det.recurso.unidad}</td>
                      <td>{det.cantidadPorUnidad}</td>
                      <td>{money(det.recurso.precioActual)}</td>
                      <td>{money(subtotal)}</td>
                      <td>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!selected.apuDetalles?.length && (
                  <tr>
                    <td colSpan={8}>Este APU aún no tiene recursos asignados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="financial-summary">
            <p>Materiales: <strong>{money(selected.apuCostoCache?.costoMateriales || 0)}</strong></p>
            <p>Mano de Obra: <strong>{money(selected.apuCostoCache?.costoManoObra || 0)}</strong></p>
            <p>Equipos: <strong>{money(selected.apuCostoCache?.costoEquipo || 0)}</strong></p>
            <p>Transporte: <strong>{money(selected.apuCostoCache?.costoTransporte || 0)}</strong></p>
            <p className="total-line">Costo Unitario Total: <strong>{money(selected.apuCostoCache?.costoTotal || 0)}</strong></p>
          </div>
        </section>
      )}
    </>
  );
}
