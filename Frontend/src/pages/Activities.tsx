import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, Search, Filter, FolderKanban } from "lucide-react";
import api from "../services/api";

type Activity = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  capituloCodigo?: string;
  capituloNombre?: string;
  presupuestoItems?: Array<{
    presupuesto?: {
      proyecto?: {
        id: string;
        nombre: string;
      };
    };
  }>;
};

type Resource = {
  id: string;
  codigo: string;
  descripcion: string;
  categoria?: string;
  unidad: string;
  tipo: string;
  costoUnitario: string | number;
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

  // Filtros y agrupamiento
  const [proyectoFiltro, setProyectoFiltro] = useState<string>("ALL");
  const [busquedaRecurso, setBusquedaRecurso] = useState("");
  const [tipoRecursoFiltro, setTipoRecursoFiltro] = useState("ALL");
  const [categoriaFiltro, setCategoriaFiltro] = useState("ALL");

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

  // Obtener lista única de proyectos asociados
  const proyectosMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((act) => {
      act.presupuestoItems?.forEach((pi) => {
        const p = pi.presupuesto?.proyecto;
        if (p) {
          map.set(p.id, p.nombre);
        }
      });
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [items]);

  // Filtrar actividades por proyecto
  const actividadesFiltradas = useMemo(() => {
    if (proyectoFiltro === "ALL") return items;
    return items.filter((act) =>
      act.presupuestoItems?.some((pi) => pi.presupuesto?.proyecto?.id === proyectoFiltro)
    );
  }, [items, proyectoFiltro]);

  // Categorías únicas disponibles en los recursos cargados
  const categoriasUnicas = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      if (r.categoria) set.add(r.categoria);
    });
    return Array.from(set).sort();
  }, [resources]);

  // Filtrar recursos para el selector de APU de forma segura
  const recursosFiltrados = useMemo(() => {
    return resources.filter((r) => {
      const matchTipo = tipoRecursoFiltro === "ALL" || r.tipo === tipoRecursoFiltro;
      const matchCat = categoriaFiltro === "ALL" || r.categoria === categoriaFiltro;
      const texto = busquedaRecurso.toLowerCase();
      const desc = (r.descripcion || "").toLowerCase();
      const cod = (r.codigo || "").toLowerCase();
      const matchTexto = !busquedaRecurso || desc.includes(texto) || cod.includes(texto);
      return matchTipo && matchCat && matchTexto;
    });
  }, [resources, busquedaRecurso, tipoRecursoFiltro, categoriaFiltro]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGO DE OBRA</p>
          <h1>Actividades y Análisis de Precios Unitarios (APU)</h1>
          <p className="muted">Gestión de partidas, capítulos y recetas de costos unitarios.</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Actividades registradas ({actividadesFiltradas.length} de {items.length})</h2>
            <p>{error || "Filtrá por proyecto o seleccioná una actividad para configurar su APU."}</p>
          </div>
          <div className="filter-group" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <FolderKanban size={18} color="#64748b" />
            <select
              className="text-input"
              style={{ width: "240px", padding: "8px" }}
              value={proyectoFiltro}
              onChange={(e) => setProyectoFiltro(e.target.value)}
            >
              <option value="ALL">Todos los proyectos ({items.length})</option>
              {proyectosMap.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Capítulo</th>
                <th>Descripción</th>
                <th>U.M.</th>
                <th>Proyecto Asociado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {actividadesFiltradas.map((x) => {
                const nombreProyecto =
                  x.presupuestoItems?.[0]?.presupuesto?.proyecto?.nombre || "Sin proyecto";
                const capitulo = x.capituloNombre || x.capituloCodigo || "General";
                return (
                  <tr key={x.id}>
                    <td className="code-cell">{x.codigo}</td>
                    <td>{capitulo}</td>
                    <td className="truncate-cell" title={x.nombre}>
                      {x.nombre}
                    </td>
                    <td>{x.unidad}</td>
                    <td><span className="project-badge">{nombreProyecto}</span></td>
                    <td>
                      <button className="text-link" onClick={() => void openApu(x.id)}>
                        Configurar APU
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!actividadesFiltradas.length && (
                <tr>
                  <td colSpan={6}>No hay actividades registradas para este filtro.</td>
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
              <p>Capítulo: <strong>{selected.capituloNombre || selected.capituloCodigo || "General"}</strong> · Unidad: <strong>{selected.unidad}</strong></p>
            </div>
            <button className="secondary-button" onClick={() => setSelected(null)}>
              Cerrar APU
            </button>
          </div>

          <div className="apu-search-bar" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                className="text-input"
                placeholder="Buscar por código o nombre de recurso..."
                value={busquedaRecurso}
                onChange={(e) => setBusquedaRecurso(e.target.value)}
              />
            </div>
            <div className="filter-input-wrapper">
              <Filter size={16} />
              <select
                className="text-input"
                value={tipoRecursoFiltro}
                onChange={(e) => setTipoRecursoFiltro(e.target.value)}
              >
                <option value="ALL">Todos los tipos</option>
                <option value="material">Materiales</option>
                <option value="mano_obra">Mano de Obra</option>
                <option value="equipo">Equipos</option>
                <option value="transporte">Transporte</option>
              </select>
            </div>
            <div className="filter-input-wrapper">
              <select
                className="text-input"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                <option value="ALL">Todas las categorías</option>
                {categoriasUnicas.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="apu-form-grid">
            <label>
              Seleccionar recurso ({recursosFiltrados.length} disponibles)
              <select className="text-input" value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
                <option value="">-- Seleccionar recurso del catálogo --</option>
                {recursosFiltrados.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.tipo.toUpperCase()}] {r.codigo} - {r.descripcion} ({r.unidad}) — C$ {Number(r.costoUnitario || 0).toFixed(2)}
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
                  <th>Descripción del Recurso</th>
                  <th>U.M.</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(selected.apuDetalles || []).map((det) => {
                  const precio = Number(det.recurso?.costoUnitario || 0);
                  const subtotal = Number(det.cantidadPorUnidad) * precio;
                  return (
                    <tr key={det.id}>
                      <td><span className="badge">{det.recurso?.tipo || "recurso"}</span></td>
                      <td className="code-cell">{det.recurso?.codigo || "—"}</td>
                      <td><strong>{det.recurso?.descripcion || "Sin descripción"}</strong></td>
                      <td>{det.recurso?.unidad || "—"}</td>
                      <td>{det.cantidadPorUnidad}</td>
                      <td>{money(precio)}</td>
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
