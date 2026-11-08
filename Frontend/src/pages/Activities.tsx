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
  const [tipoSeccion, setTipoSeccion] = useState<"material" | "mano_obra" | "equipo_transporte">("material");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [proyectoFiltro, setProyectoFiltro] = useState<string>("ALL");
  const [busquedaRecurso, setBusquedaRecurso] = useState("");
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

  const actividadesFiltradas = useMemo(() => {
    if (proyectoFiltro === "ALL") return items;
    return items.filter((act) =>
      act.presupuestoItems?.some((pi) => pi.presupuesto?.proyecto?.id === proyectoFiltro)
    );
  }, [items, proyectoFiltro]);

  // Recursos filtrados según la sección activa (Materiales, Mano de Obra, Equipos/Transporte)
  const recursosDisponibles = useMemo(() => {
    return resources.filter((r) => {
      let matchTipo = false;
      if (tipoSeccion === "material") matchTipo = r.tipo === "material";
      else if (tipoSeccion === "mano_obra") matchTipo = r.tipo === "mano_obra";
      else if (tipoSeccion === "equipo_transporte") matchTipo = r.tipo === "equipo" || r.tipo === "transporte";

      const matchCat = categoriaFiltro === "ALL" || r.categoria === categoriaFiltro;
      const texto = busquedaRecurso.toLowerCase();
      const desc = (r.descripcion || "").toLowerCase();
      const cod = (r.codigo || "").toLowerCase();
      const matchTexto = !busquedaRecurso || desc.includes(texto) || cod.includes(texto);
      return matchTipo && matchCat && matchTexto;
    });
  }, [resources, tipoSeccion, busquedaRecurso, categoriaFiltro]);

  // Desglosar detalles actuales de APU
  const detallesMateriales = useMemo(() => {
    return selected?.apuDetalles?.filter((d) => d.recurso?.tipo === "material") || [];
  }, [selected]);

  const detallesManoDeObra = useMemo(() => {
    return selected?.apuDetalles?.filter((d) => d.recurso?.tipo === "mano_obra") || [];
  }, [selected]);

  const detallesEquiposTransporte = useMemo(() => {
    return selected?.apuDetalles?.filter((d) => d.recurso?.tipo === "equipo" || d.recurso?.tipo === "transporte") || [];
  }, [selected]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGO DE OBRA</p>
          <h1>Actividades y Análisis de Precios Unitarios (APU)</h1>
          <p className="muted">Desglose técnico por Materiales, Mano de Obra, Equipos y Transporte.</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Actividades registradas ({actividadesFiltradas.length} de {items.length})</h2>
            <p>{error || mensaje || "Seleccioná una actividad para configurar sus costos unitarios."}</p>
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
                <option key={p.id} value={p.id}>{p.nombre}</option>
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
                <th>Proyecto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {actividadesFiltradas.map((x) => {
                const nombreProyecto = x.presupuestoItems?.[0]?.presupuesto?.proyecto?.nombre || "Sin proyecto";
                const capitulo = x.capituloNombre || x.capituloCodigo || "General";
                return (
                  <tr key={x.id}>
                    <td className="code-cell">{x.codigo}</td>
                    <td>{capitulo}</td>
                    <td className="truncate-cell" title={x.nombre}>{x.nombre}</td>
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
                  <td colSpan={6}>No hay actividades registradas.</td>
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
              <p className="muted">
                Las cantidades de HH y HM representan tiempo promedio por unidad
                de actividad; los APUs automáticos son editables y deben revisarse.
                Agregue los materiales que falten: los que no tengan precio en el
                catálogo no se incluyen en el costo.
              </p>
            </div>
            <button className="secondary-button" onClick={() => setSelected(null)}>
              Cerrar APU
            </button>
          </div>

          {/* Pestañas de secciones de APU */}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
            <button
              className={tipoSeccion === "material" ? "primary-button" : "secondary-button"}
              onClick={() => { setTipoSeccion("material"); setRecursoId(""); }}
            >
              1. Materiales ({detallesMateriales.length})
            </button>
            <button
              className={tipoSeccion === "mano_obra" ? "primary-button" : "secondary-button"}
              onClick={() => { setTipoSeccion("mano_obra"); setRecursoId(""); }}
            >
              2. Mano de Obra ({detallesManoDeObra.length})
            </button>
            <button
              className={tipoSeccion === "equipo_transporte" ? "primary-button" : "secondary-button"}
              onClick={() => { setTipoSeccion("equipo_transporte"); setRecursoId(""); }}
            >
              3. Equipos y Transporte ({detallesEquiposTransporte.length})
            </button>
          </div>

          <div className="apu-search-bar" style={{ marginTop: "15px" }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                className="text-input"
                placeholder={
                  tipoSeccion === "material" ? "Buscar material..." :
                  tipoSeccion === "mano_obra" ? "Buscar cargo o mano de obra..." : "Buscar equipo o transporte..."
                }
                value={busquedaRecurso}
                onChange={(e) => setBusquedaRecurso(e.target.value)}
              />
            </div>
            <div className="filter-input-wrapper">
              <Filter size={16} />
              <select
                className="text-input"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                <option value="ALL">Todas las categorías</option>
                <option value="Materiales de Construcción">Materiales de Construcción</option>
                <option value="Mano de Obra">Mano de Obra</option>
                <option value="Equipos y Maquinaria">Equipos y Maquinaria</option>
                <option value="Transporte y Acarreo">Transporte y Acarreo</option>
              </select>
            </div>
          </div>

          <div className="apu-form-grid">
            <label>
              {tipoSeccion === "material" ? "Seleccionar Material" :
               tipoSeccion === "mano_obra" ? "Seleccionar Cargo / Mano de Obra" : "Seleccionar Equipo / Transporte"} ({recursosDisponibles.length} disponibles)
              <select className="text-input" value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
                <option value="">-- Seleccionar de la lista --</option>
                {recursosDisponibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.tipo.toUpperCase()}] {r.codigo} - {r.descripcion} ({r.unidad}) — C$ {Number(r.costoUnitario || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tipoSeccion === "material" ? "Cantidad por unidad" :
               tipoSeccion === "mano_obra" ? "HH por unidad de actividad" : "HM por unidad de actividad / viajes"}
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
              <Plus size={16} /> Agregar a la partida
            </button>
          </div>

          {mensaje && <div className="import-success">{mensaje}</div>}
          {error && <div className="import-error">{error}</div>}

          {/* Tabla 1: Materiales */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Materiales de la Actividad</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción del Material</th>
                  <th>U.M.</th>
                  <th>Cant. / Unidad de actividad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detallesMateriales.map((det) => {
                  const precio = Number(det.recurso?.costoUnitario || 0);
                  const subtotal = Number(det.cantidadPorUnidad) * precio;
                  return (
                    <tr key={det.id}>
                      <td className="code-cell">{det.recurso?.codigo}</td>
                      <td><strong>{det.recurso?.descripcion}</strong></td>
                      <td>{det.recurso?.unidad}</td>
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
                {!detallesMateriales.length && (
                  <tr><td colSpan={7}>No hay materiales agregados en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tabla 2: Mano de Obra */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Mano de Obra (Cargos, Horas-Hombre y Salario)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cargo / Descripción</th>
                  <th>U.M.</th>
                  <th>Horas-Hombre (HH) / unidad</th>
                  <th>Salario x Hora</th>
                  <th>Monto Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detallesManoDeObra.map((det) => {
                  const salarioHora = Number(det.recurso?.costoUnitario || 0);
                  const monto = Number(det.cantidadPorUnidad) * salarioHora;
                  return (
                    <tr key={det.id}>
                      <td className="code-cell">{det.recurso?.codigo}</td>
                      <td><strong>{det.recurso?.descripcion}</strong></td>
                      <td>{det.recurso?.unidad}</td>
                      <td>{det.cantidadPorUnidad}</td>
                      <td>{money(salarioHora)}</td>
                      <td>{money(monto)}</td>
                      <td>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!detallesManoDeObra.length && (
                  <tr><td colSpan={7}>No hay mano de obra agregada en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tabla 3: Equipos y Transporte */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Equipos y Transporte (Horas-Máquina / Renta Horaria)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción / Maquinaria</th>
                  <th>U.M.</th>
                  <th>Horas-Máquina (HM) / unidad o viajes</th>
                  <th>Renta Horaria</th>
                  <th>Monto Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detallesEquiposTransporte.map((det) => {
                  const renta = Number(det.recurso?.costoUnitario || 0);
                  const monto = Number(det.cantidadPorUnidad) * renta;
                  return (
                    <tr key={det.id}>
                      <td className="code-cell">{det.recurso?.codigo}</td>
                      <td><strong>{det.recurso?.descripcion}</strong></td>
                      <td>{det.recurso?.unidad}</td>
                      <td>{det.cantidadPorUnidad}</td>
                      <td>{money(renta)}</td>
                      <td>{money(monto)}</td>
                      <td>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!detallesEquiposTransporte.length && (
                  <tr><td colSpan={7}>No hay equipos ni transporte agregados en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="financial-summary">
            <p>Costo Materiales: <strong>{money(selected.apuCostoCache?.costoMateriales || 0)}</strong></p>
            <p>Costo Mano de Obra: <strong>{money(selected.apuCostoCache?.costoManoObra || 0)}</strong></p>
            <p>Costo Equipos: <strong>{money(selected.apuCostoCache?.costoEquipo || 0)}</strong></p>
            <p>Costo Transporte: <strong>{money(selected.apuCostoCache?.costoTransporte || 0)}</strong></p>
            <p className="total-line">Costo Unitario Total (P.U.): <strong>{money(selected.apuCostoCache?.costoTotal || 0)}</strong></p>
          </div>
        </section>
      )}
    </>
  );
}
