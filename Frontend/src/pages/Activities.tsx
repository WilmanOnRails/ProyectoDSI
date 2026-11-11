import { useEffect, useState, useMemo, useRef } from "react";
import { Pencil, Plus, Trash2, Search, Filter, FolderKanban } from "lucide-react";
import api, { apiGet } from "../services/api";
import HorizontalTable from "../components/HorizontalTable";
import { canManagePlatformData } from "../services/authSession";

type Activity = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  capituloCodigo?: string;
  capituloNombre?: string;
  presupuestoItems?: Array<{
    id: string;
    presupuestoId: string;
    cantidadProyecto: string | number;
    presupuesto?: {
      id: string;
      nombre?: string;
      proyecto?: {
        id: string;
        nombre: string;
      };
    };
  }>;
};

type ProjectOption = {
  id: string;
  nombre: string;
};

type BudgetOption = {
  id: string;
  nombre?: string;
  proyectoId: string;
  proyecto?: ProjectOption;
};

type ActivityForm = {
  nombre: string;
  unidad: string;
  capituloCodigo: string;
  capituloNombre: string;
  proyectoId: string;
  presupuestoId: string;
  cantidadProyecto: string;
};

const EMPTY_ACTIVITY_FORM: ActivityForm = {
  nombre: "",
  unidad: "",
  capituloCodigo: "",
  capituloNombre: "",
  proyectoId: "",
  presupuestoId: "",
  cantidadProyecto: "",
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
const PAGE_SIZE = 50;

export default function Activities() {
  const canEdit = canManagePlatformData();
  const [items, setItems] = useState<Activity[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<ActivityApuData | null>(null);
  const [recursoId, setRecursoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [tipoSeccion, setTipoSeccion] = useState<"material" | "mano_obra" | "equipo_transporte">("material");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [scrollToApu, setScrollToApu] = useState(false);
  const apuDetailRef = useRef<HTMLElement>(null);
  const [detalleEditando, setDetalleEditando] = useState<ApuDetalle | null>(null);
  const [cantidadEditada, setCantidadEditada] = useState("");
  const [precioEditado, setPrecioEditado] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingBudgetItemId, setEditingBudgetItemId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>(EMPTY_ACTIVITY_FORM);
  const [savingActivity, setSavingActivity] = useState(false);

  const [proyectoFiltro, setProyectoFiltro] = useState<string>("ALL");
  const [busquedaRecurso, setBusquedaRecurso] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("ALL");
  const [resourceSearchApplied, setResourceSearchApplied] = useState("");
  const activityQueryKey = JSON.stringify([
    page,
    proyectoFiltro,
    reloadCounter,
  ]);
  const activitiesLoading = loadedActivityQuery !== activityQueryKey;
  const selectedActivityId = selected?.id;

  useEffect(() => {
    let active = true;
    const params = {
      pagina: page,
      limite: PAGE_SIZE,
      ...(proyectoFiltro !== "ALL" ? { proyectoId: proyectoFiltro } : {}),
    };
    const request =
      reloadCounter === 0
        ? apiGet<ActivityPage>("/activities", params)
        : api.get<ActivityPage>("/activities", { params }).then(({ data }) => data);

    request
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotalActivities(result.total);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar las actividades.");
      })
      .finally(() => {
        if (active) setLoadedActivityQuery(activityQueryKey);
      });

  const loadProjectsAndBudgets = () => {
    Promise.all([
      api.get<ProjectOption[]>("/projects"),
      api.get<BudgetOption[]>("/presupuestos"),
    ])
      .then(([projectResponse, budgetResponse]) => {
        setProjects(projectResponse.data);
        setBudgets(budgetResponse.data);
      })
      .catch(() => setError("No se pudieron cargar los proyectos y presupuestos."));
  };

  const loadResources = () => {
    api
      .get<Resource[]>("/recursos")
      .then((r) => setResources(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    loadActivities();
    loadProjectsAndBudgets();
    loadResources();
  }, []);

  const presupuestosDelProyecto = useMemo(
    () => budgets.filter((budget) => budget.proyectoId === activityForm.proyectoId),
    [budgets, activityForm.proyectoId],
  );

  const capitulosDelProyecto = useMemo(() => {
    const chapters = new Map<string, { codigo: string; nombre: string }>();
    for (const activity of items) {
      const perteneceAlProyecto = activity.presupuestoItems?.some(
        (item) => item.presupuesto?.proyecto?.id === activityForm.proyectoId,
      );
      if (perteneceAlProyecto && activity.capituloCodigo && activity.capituloNombre) {
        chapters.set(activity.capituloCodigo, {
          codigo: activity.capituloCodigo,
          nombre: activity.capituloNombre,
        });
      }
    }

    if (activityForm.capituloCodigo && activityForm.capituloNombre) {
      chapters.set(activityForm.capituloCodigo, {
        codigo: activityForm.capituloCodigo,
        nombre: activityForm.capituloNombre,
      });
    }
    if (chapters.size === 0) {
      chapters.set("GEN", { codigo: "GEN", nombre: "General" });
    }
    return Array.from(chapters.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "es"),
    );
  }, [items, activityForm.proyectoId, activityForm.capituloCodigo, activityForm.capituloNombre]);

  const openApu = async (id: string, shouldScroll = false) => {
    try {
      const data = await apiGet<ActivityApuData>(`/apus/actividad/${id}`);
      setSelected(data);
      setScrollToApu(shouldScroll);
      setError("");
      setMensaje("");
    } catch {
      setError("No se pudo cargar el APU de la actividad.");
    }
  };

  useEffect(() => {
    if (!selected || !scrollToApu) return;
    apuDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, scrollToApu]);

  const addApuItem = async () => {
    if (!selected || !recursoId) return;
    if (!Number.isFinite(Number(cantidad)) || Number(cantidad) < 1) {
      setError("La cantidad por unidad de actividad debe ser como mínimo 1.");
      return;
    }
    try {
      await api.post("/apus", {
        actividadId: selected.id,
        recursoId,
        cantidadPorUnidad: Number(cantidad),
      });
      setMensaje("Recurso agregado al APU correctamente.");
      setRecursoId("");
      setCantidad("1");
      reloadActivities();
      await openApu(selected.id);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "No se pudo agregar el recurso al APU.");
    }
  };

  const removeApuItem = async (apuId: string) => {
    if (!selected) return;
    try {
      await api.delete(`/apus/${apuId}`);
      setMensaje("Recurso eliminado del APU.");
      reloadActivities();
      await openApu(selected.id);
    } catch {
      setError("No se pudo eliminar el recurso del APU.");
    }
  };

  const abrirNuevaActividad = () => {
    setEditingActivityId(null);
    setEditingBudgetItemId(null);
    setActivityForm(EMPTY_ACTIVITY_FORM);
    setError("");
    setMensaje("");
    setActivityModalOpen(true);
  };

  const abrirEdicionActividad = (activity: Activity) => {
    const budgetItem =
      activity.presupuestoItems?.find(
        (item) =>
          proyectoFiltro !== "ALL" &&
          item.presupuesto?.proyecto?.id === proyectoFiltro,
      ) ?? activity.presupuestoItems?.[0];
    if (!budgetItem) {
      setError("Esta actividad no está asociada a un presupuesto de proyecto.");
      return;
    }

    setEditingActivityId(activity.id);
    setEditingBudgetItemId(budgetItem.id);
    setActivityForm({
      nombre: activity.nombre,
      unidad: activity.unidad,
      capituloCodigo: activity.capituloCodigo ?? "",
      capituloNombre: activity.capituloNombre ?? "",
      proyectoId: budgetItem.presupuesto?.proyecto?.id ?? "",
      presupuestoId: budgetItem.presupuesto?.id ?? budgetItem.presupuestoId,
      cantidadProyecto: String(budgetItem.cantidadProyecto),
    });
    setError("");
    setMensaje("");
    setActivityModalOpen(true);
  };

  const guardarActividad = async () => {
    if (savingActivity) return;
    const cantidadProyecto = Number(activityForm.cantidadProyecto);
    const cantidadValida =
      Number.isFinite(cantidadProyecto) &&
      cantidadProyecto > 0 &&
      (activityForm.cantidadProyecto.split(".")[1]?.length ?? 0) <= 2;
    const formularioCompleto =
      activityForm.nombre.trim() &&
      activityForm.unidad.trim() &&
      activityForm.capituloCodigo &&
      activityForm.capituloNombre &&
      activityForm.proyectoId &&
      activityForm.presupuestoId &&
      cantidadValida;

    if (!formularioCompleto) {
      setError("Completa todos los campos con datos válidos antes de guardar.");
      return;
    }

    setSavingActivity(true);
    setError("");
    try {
      if (editingActivityId && editingBudgetItemId) {
        await api.patch(`/activities/${editingActivityId}`, {
          nombre: activityForm.nombre.trim(),
          unidad: activityForm.unidad.trim(),
          capituloCodigo: activityForm.capituloCodigo,
          capituloNombre: activityForm.capituloNombre,
          presupuestoItemId: editingBudgetItemId,
          cantidadProyecto,
        });
      } else {
        await api.post("/activities", {
          nombre: activityForm.nombre.trim(),
          unidad: activityForm.unidad.trim(),
          capituloCodigo: activityForm.capituloCodigo,
          capituloNombre: activityForm.capituloNombre,
          proyectoId: activityForm.proyectoId,
          presupuestoId: activityForm.presupuestoId,
          cantidadProyecto,
        });
      }

      const [activityResponse, budgetResponse] = await Promise.all([
        api.get<Activity[]>("/activities"),
        api.get<BudgetOption[]>("/presupuestos"),
      ]);
      setItems(activityResponse.data);
      setBudgets(budgetResponse.data);
      setMensaje(
        editingActivityId
          ? "Actividad actualizada correctamente."
          : "Actividad agregada al proyecto y presupuesto. Su código y APU se generaron automáticamente.",
      );
      setActivityModalOpen(false);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "No se pudo guardar la actividad.",
      );
    } finally {
      setSavingActivity(false);
    }
  };

  const eliminarActividadDelProyecto = async (activity: Activity) => {
    const budgetItem =
      activity.presupuestoItems?.find(
        (item) =>
          proyectoFiltro !== "ALL" &&
          item.presupuesto?.proyecto?.id === proyectoFiltro,
      ) ?? activity.presupuestoItems?.[0];
    if (!budgetItem) {
      setError("Esta actividad no está asociada a un presupuesto de proyecto.");
      return;
    }
    if (
      !window.confirm(
        "¿Quieres quitar esta actividad del proyecto y su presupuesto? Si no está en otros presupuestos, también se eliminará del catálogo.",
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/activities/${activity.id}/presupuesto-items/${budgetItem.id}`,
      );
      if (selected?.id === activity.id) setSelected(null);
      const [activityResponse, budgetResponse] = await Promise.all([
        api.get<Activity[]>("/activities"),
        api.get<BudgetOption[]>("/presupuestos"),
      ]);
      setItems(activityResponse.data);
      setBudgets(budgetResponse.data);
      setMensaje("Actividad quitada del proyecto y presupuesto.");
      setError("");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "No se pudo eliminar la actividad.",
      );
    }
  };

  const iniciarEdicion = (detalle: ApuDetalle) => {
    setDetalleEditando(detalle);
    setCantidadEditada(String(detalle.cantidadPorUnidad));
    setPrecioEditado(String(detalle.recurso.costoUnitario));
    setError("");
    setMensaje("");
  };

  const guardarEdicion = async () => {
    if (!detalleEditando || !selected || guardandoEdicion) return;

    const cantidadNueva = Number(cantidadEditada);
    const precioNuevo = Number(precioEditado);
    const decimalesCantidad = cantidadEditada.split(".")[1]?.length ?? 0;
    const decimalesPrecio = precioEditado.split(".")[1]?.length ?? 0;

    if (
      !Number.isFinite(cantidadNueva) ||
      cantidadNueva < 1 ||
      decimalesCantidad > 4
    ) {
      setError("La cantidad por unidad debe ser al menos 1 y tener máximo 4 decimales.");
      return;
    }
    if (
      !Number.isFinite(precioNuevo) ||
      precioNuevo < 0 ||
      decimalesPrecio > 2
    ) {
      setError("El precio debe ser mayor o igual a 0 y tener máximo 2 decimales.");
      return;
    }

    setGuardandoEdicion(true);
    setError("");
    try {
      const precioAnterior = Number(detalleEditando.recurso.costoUnitario);
      const cantidadAnterior = Number(detalleEditando.cantidadPorUnidad);

      if (precioNuevo !== precioAnterior) {
        await api.patch(`/recursos/${detalleEditando.recurso.id}/precio`, {
          precio: precioNuevo,
          fuente: "Edición desde APU",
        });
        setResources((current) =>
          current.map((resource) =>
            resource.id === detalleEditando.recurso.id
              ? { ...resource, costoUnitario: precioNuevo }
              : resource,
          ),
        );
      }

      if (cantidadNueva !== cantidadAnterior) {
        await api.patch(`/apus/${detalleEditando.id}`, {
          cantidadPorUnidad: cantidadNueva,
        });
      }

      const actualizado = await api.get<ActivityApuData>(
        `/apus/actividad/${selected.id}`,
      );
      setSelected(actualizado.data);
      setMensaje("Precio y cantidad del recurso actualizados correctamente.");
      setDetalleEditando(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "No se pudo completar la edición. Si se cambió el precio, verifica el catálogo de recursos.",
      );
    } finally {
      setGuardandoEdicion(false);
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
            <h2>Actividades registradas ({totalActivities})</h2>
            <p>{error || mensaje || (canEdit ? "Seleccioná una actividad para configurar sus costos unitarios." : "Seleccioná una actividad para consultar sus costos unitarios.")}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
            <button
              className="primary-button"
              onClick={abrirNuevaActividad}
              disabled={projects.length === 0}
              title={projects.length === 0 ? "Primero crea un proyecto" : "Agregar actividad"}
            >
              <Plus size={16} /> Agregar actividad
            </button>
          </div>
        </div>

        <HorizontalTable>
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
                const itemProyecto =
                  x.presupuestoItems?.find(
                    (item) =>
                      proyectoFiltro !== "ALL" &&
                      item.presupuesto?.proyecto?.id === proyectoFiltro,
                  ) ?? x.presupuestoItems?.[0];
                const nombreProyecto = itemProyecto?.presupuesto?.proyecto?.nombre || "Sin proyecto";
                const capitulo = x.capituloNombre || x.capituloCodigo || "General";
                return (
                  <tr key={x.id}>
                    <td className="code-cell">{x.codigo}</td>
                    <td>{capitulo}</td>
                    <td className="truncate-cell" title={x.nombre}>{x.nombre}</td>
                    <td>{x.unidad}</td>
                    <td><span className="project-badge">{nombreProyecto}</span></td>
                    <td>
                      <button className="text-link" onClick={() => void openApu(x.id, true)}>
                        {canEdit ? "Configurar APU" : "Ver APU"}
                      </button>
                      <button
                        className="text-link"
                        onClick={() => abrirEdicionActividad(x)}
                        title="Editar actividad"
                        style={{ marginLeft: "10px" }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-btn-danger"
                        onClick={() => void eliminarActividadDelProyecto(x)}
                        title="Quitar actividad del proyecto"
                        style={{ marginLeft: "8px" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!activitiesLoading && !items.length && (
                <tr>
                  <td colSpan={6}>No hay actividades registradas.</td>
                </tr>
              )}
              {activitiesLoading && (
                <tr>
                  <td colSpan={6}>Cargando actividades...</td>
                </tr>
              )}
            </tbody>
          </table>
        </HorizontalTable>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
          <span>
            {totalActivities === 0
              ? "Sin actividades"
              : `Mostrando ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalActivities)} de ${totalActivities}`}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || activitiesLoading}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              onClick={() => setPage((current) => current + 1)}
              disabled={page * PAGE_SIZE >= totalActivities || activitiesLoading}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <section className="panel data-panel apu-detail-panel" ref={apuDetailRef}>
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
              1. Materiales
            </button>
            <button
              className={tipoSeccion === "mano_obra" ? "primary-button" : "secondary-button"}
              onClick={() => { setTipoSeccion("mano_obra"); setRecursoId(""); }}
            >
              2. Mano de Obra
            </button>
            <button
              className={tipoSeccion === "equipo_transporte" ? "primary-button" : "secondary-button"}
              onClick={() => { setTipoSeccion("equipo_transporte"); setRecursoId(""); }}
            >
              3. Equipos y Transporte
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

          {canEdit && <div className="apu-form-grid">
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
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <button className="primary-button add-apu-btn" onClick={() => void addApuItem()}>
              <Plus size={16} /> Agregar a la partida
            </button>
          </div>}

          {mensaje && <div className="import-success">{mensaje}</div>}
          {error && <div className="import-error">{error}</div>}

          {/* Tabla 1: Materiales */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Materiales de la Actividad</h3>
          <HorizontalTable>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción del Material</th>
                  <th>U.M.</th>
                  <th>Cant. / Unidad de actividad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                  {canEdit && <th></th>}
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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y cantidad">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>}
                    </tr>
                  );
                })}
                {!detallesMateriales.length && (
                  <tr><td colSpan={canEdit ? 7 : 6}>No hay materiales agregados en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </HorizontalTable>

          {/* Tabla 2: Mano de Obra */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Mano de Obra (Cargos, Horas-Hombre y Salario)</h3>
          <HorizontalTable>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cargo / Descripción</th>
                  <th>U.M.</th>
                  <th>Horas-Hombre (HH) / unidad</th>
                  <th>Salario x Hora</th>
                  <th>Monto Total</th>
                  {canEdit && <th></th>}
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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y horas">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>}
                    </tr>
                  );
                })}
                {!detallesManoDeObra.length && (
                  <tr><td colSpan={canEdit ? 7 : 6}>No hay mano de obra agregada en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </HorizontalTable>

          {/* Tabla 3: Equipos y Transporte */}
          <h3 style={{ marginTop: "24px", fontSize: "15px", color: "#172338" }}>Equipos y Transporte (Horas-Máquina / Renta Horaria)</h3>
          <HorizontalTable>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción / Maquinaria</th>
                  <th>U.M.</th>
                  <th>Horas-Máquina (HM) / unidad o viajes</th>
                  <th>Renta Horaria</th>
                  <th>Monto Total</th>
                  {canEdit && <th></th>}
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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y cantidad">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn-danger" onClick={() => void removeApuItem(det.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>}
                    </tr>
                  );
                })}
                {!detallesEquiposTransporte.length && (
                  <tr><td colSpan={canEdit ? 7 : 6}>No hay equipos ni transporte agregados en este APU.</td></tr>
                )}
              </tbody>
            </table>
          </HorizontalTable>

          <div className="financial-summary">
            <p>Costo Materiales: <strong>{money(selected.apuCostoCache?.costoMateriales || 0)}</strong></p>
            <p>Costo Mano de Obra: <strong>{money(selected.apuCostoCache?.costoManoObra || 0)}</strong></p>
            <p>Costo Equipos: <strong>{money(selected.apuCostoCache?.costoEquipo || 0)}</strong></p>
            <p>Costo Transporte: <strong>{money(selected.apuCostoCache?.costoTransporte || 0)}</strong></p>
            <p className="total-line">Costo Unitario Total (P.U.): <strong>{money(selected.apuCostoCache?.costoTotal || 0)}</strong></p>
          </div>
        </section>
      )}

      {detalleEditando && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Editar recurso del APU</h3>
            <p>
              {detalleEditando.recurso.codigo} — {detalleEditando.recurso.descripcion}.
              El precio pertenece al catálogo y afecta otros APUs que usen este recurso.
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                {detalleEditando.recurso.tipo === "mano_obra"
                  ? "Horas-Hombre (HH) / unidad"
                  : detalleEditando.recurso.tipo === "material"
                    ? "Cantidad / unidad"
                    : "Horas-Máquina (HM) o viajes / unidad"}
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  step="0.0001"
                  value={cantidadEditada}
                  onChange={(event) => setCantidadEditada(event.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Precio unitario vigente (C$)
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioEditado}
                  onChange={(event) => setPrecioEditado(event.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button
                className="secondary-button"
                onClick={() => setDetalleEditando(null)}
                disabled={guardandoEdicion}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                onClick={() => void guardarEdicion()}
                disabled={guardandoEdicion}
              >
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px" }}>
            <h3>{editingActivityId ? "Editar actividad" : "Agregar actividad"}</h3>
            <p>
              {editingActivityId
                ? "Actualiza la descripción, unidad, capítulo y cantidad de esta actividad."
                : "El código y el APU inicial se generan automáticamente. Completa todos los campos para agregarla al proyecto y su presupuesto."}
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              {!editingActivityId && (
                <div>
                  <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                    Proyecto *
                    <select
                      className="text-input"
                      required
                      value={activityForm.proyectoId}
                      onChange={(event) => {
                        const proyectoId = event.target.value;
                        const budgetsOfProject = budgets.filter(
                          (budget) => budget.proyectoId === proyectoId,
                        );
                        setActivityForm((current) => ({
                          ...current,
                          proyectoId,
                          presupuestoId:
                            budgetsOfProject.length === 1
                              ? budgetsOfProject[0].id
                              : "",
                          capituloCodigo: "",
                          capituloNombre: "",
                        }));
                      }}
                    >
                      <option value="">-- Selecciona un proyecto --</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activityForm.proyectoId &&
                    !presupuestosDelProyecto.length && (
                      <p className="muted" style={{ marginTop: "6px" }}>
                        Este proyecto aún no tiene presupuesto. Crea uno antes de agregarle actividades.
                      </p>
                    )}
                </div>
              )}

              {editingActivityId ? (
                <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                  Proyecto y presupuesto
                  <input
                    className="text-input"
                    value={(() => {
                      const budget = budgets.find(
                        (option) => option.id === activityForm.presupuestoId,
                      );
                      return `${budget?.proyecto?.nombre ?? "Proyecto asociado"} — ${budget?.nombre ?? "Presupuesto"}`;
                    })()}
                    readOnly
                  />
                </label>
              ) : (
                <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                  Presupuesto *
                  <select
                    className="text-input"
                    required
                    value={activityForm.presupuestoId}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        presupuestoId: event.target.value,
                      }))
                    }
                    disabled={!activityForm.proyectoId || presupuestosDelProyecto.length === 0}
                  >
                    <option value="">-- Selecciona un presupuesto --</option>
                    {presupuestosDelProyecto.map((budget) => (
                      <option key={budget.id} value={budget.id}>
                        {budget.nombre || "Presupuesto sin nombre"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Capítulo *
                <select
                  className="text-input"
                  required
                  value={activityForm.capituloCodigo}
                  onChange={(event) => {
                    const chapter = capitulosDelProyecto.find(
                      (option) => option.codigo === event.target.value,
                    );
                    setActivityForm((current) => ({
                      ...current,
                      capituloCodigo: chapter?.codigo ?? "",
                      capituloNombre: chapter?.nombre ?? "",
                    }));
                  }}
                  disabled={!editingActivityId && !activityForm.proyectoId}
                >
                  <option value="">-- Selecciona un capítulo --</option>
                  {capitulosDelProyecto.map((chapter) => (
                    <option key={chapter.codigo} value={chapter.codigo}>
                      {chapter.codigo} — {chapter.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Descripción de la actividad *
                <input
                  className="text-input"
                  required
                  maxLength={300}
                  value={activityForm.nombre}
                  onChange={(event) =>
                    setActivityForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Unidad de medida *
                <input
                  className="text-input"
                  required
                  maxLength={30}
                  placeholder="m2, m3, ml, und..."
                  value={activityForm.unidad}
                  onChange={(event) =>
                    setActivityForm((current) => ({
                      ...current,
                      unidad: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Cantidad para el presupuesto *
                <input
                  className="text-input"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={activityForm.cantidadProyecto}
                  onChange={(event) =>
                    setActivityForm((current) => ({
                      ...current,
                      cantidadProyecto: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            {error && <div className="import-error" style={{ marginTop: "12px" }}>{error}</div>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button
                className="secondary-button"
                onClick={() => setActivityModalOpen(false)}
                disabled={savingActivity}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                onClick={() => void guardarActividad()}
                disabled={savingActivity || projects.length === 0}
              >
                {savingActivity
                  ? "Guardando..."
                  : editingActivityId
                    ? "Guardar cambios"
                    : "Agregar actividad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
