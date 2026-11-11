import { useEffect, useState, useMemo, useRef } from "react";
import { Pencil, Plus, Trash2, Search, Filter, FolderKanban } from "lucide-react";
import api from "../services/api";
import HorizontalTable from "../components/HorizontalTable";

const ACTIVITY_PAGE_SIZE = 50;
const RESOURCE_PAGE_SIZE = 100;

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

type ApuMutationResponse = ApuDetalle & {
  apuCostoCache: ApuCache;
};

type ApuDeleteResponse = Pick<ApuDetalle, "id"> & {
  apuCostoCache: ApuCache;
};

type ActivityPage = {
  items: Activity[];
  total: number;
  pagina: number;
  limite: number;
};

type ResourcePage = {
  items: Resource[];
  total: number;
  pagina: number;
  limite: number;
};

const money = (v: string | number) =>
  `C$ ${Number(v || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Activities() {
  const [items, setItems] = useState<Activity[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [page, setPage] = useState(1);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [selected, setSelected] = useState<ActivityApuData | null>(null);
  const [recursoId, setRecursoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [savingApuItem, setSavingApuItem] = useState(false);
  const [loadingApuId, setLoadingApuId] = useState<string | null>(null);
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
  const [busquedaRecursoAplicada, setBusquedaRecursoAplicada] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("ALL");
  const selectedActivityId = selected?.id;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const params = {
      pagina: page,
      limite: ACTIVITY_PAGE_SIZE,
      ...(proyectoFiltro !== "ALL" ? { proyectoId: proyectoFiltro } : {}),
    };

    api
      .get<ActivityPage>("/activities", {
        params,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setTotalActivities(data.total);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          setError("No se pudieron cargar las actividades.");
        }
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setActivitiesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, proyectoFiltro]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api
      .get<ProjectOption[]>("/projects", { signal: controller.signal })
      .then(({ data }) => {
        if (active) setProjects(data);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          setError("No se pudieron cargar los proyectos.");
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setBusquedaRecursoAplicada(busquedaRecurso.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [busquedaRecurso]);

  useEffect(() => {
    if (!selectedActivityId) return;

    let active = true;
    const controller = new AbortController();
    const tipos =
      tipoSeccion === "equipo_transporte"
        ? ["equipo", "transporte"]
        : [tipoSeccion];
    const requests = tipos.map((tipo) =>
      api.get<ResourcePage>("/recursos", {
        signal: controller.signal,
        params: {
          activo: true,
          tipo,
          pagina: 1,
          limite: RESOURCE_PAGE_SIZE,
          ...(categoriaFiltro !== "ALL" ? { categoria: categoriaFiltro } : {}),
          ...(busquedaRecursoAplicada
            ? { buscar: busquedaRecursoAplicada }
            : {}),
        },
      }),
    );

    Promise.all(requests)
      .then((responses) => {
        if (active) {
          setResources(responses.flatMap(({ data }) => data.items));
          setResourcesLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setResources([]);
          setResourcesLoading(false);
          if (!controller.signal.aborted) {
            setError("No se pudieron cargar los recursos para el APU.");
          }
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    selectedActivityId,
    tipoSeccion,
    categoriaFiltro,
    busquedaRecursoAplicada,
  ]);

  const loadBudgets = async (): Promise<boolean> => {
    if (budgetsLoaded) return true;

    try {
      const { data } = await api.get<BudgetOption[]>("/presupuestos");
      setBudgets(data);
      setBudgetsLoaded(true);
      return true;
    } catch {
      setError("No se pudieron cargar los presupuestos.");
      return false;
    }
  };

  const reloadActivities = async () => {
    const params = {
      pagina: page,
      limite: ACTIVITY_PAGE_SIZE,
      ...(proyectoFiltro !== "ALL" ? { proyectoId: proyectoFiltro } : {}),
    };
    const { data } = await api.get<ActivityPage>("/activities", { params });
    setItems(data.items);
    setTotalActivities(data.total);
  };

  const changeResourceSection = (
    section: "material" | "mano_obra" | "equipo_transporte",
  ) => {
    if (section === tipoSeccion) return;
    setResources([]);
    setResourcesLoading(true);
    setTipoSeccion(section);
    setRecursoId("");
  };

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
    setLoadingApuId(id);
    setSelected(null);
    setResources([]);
    setResourcesLoading(true);
    try {
      const res = await api.get<ActivityApuData>(`/apus/actividad/${id}`);
      setSelected(res.data);
      setScrollToApu(shouldScroll);
      setError("");
      setMensaje("");
    } catch {
      setResourcesLoading(false);
      setError("No se pudo cargar el APU de la actividad.");
    } finally {
      setLoadingApuId(null);
    }
  };

  useEffect(() => {
    if (!selected || !scrollToApu) return;
    apuDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, scrollToApu]);

  const addApuItem = async () => {
    if (!selected || !recursoId || savingApuItem) return;
    if (!Number.isFinite(Number(cantidad)) || Number(cantidad) < 1) {
      setError("La cantidad por unidad de actividad debe ser como mínimo 1.");
      return;
    }
    const recurso = resources.find((item) => item.id === recursoId);
    if (!recurso) {
      setError("Selecciona un recurso disponible para agregar al APU.");
      return;
    }

    const actividadId = selected.id;
    const detalleOptimistaId = `optimistic-${Date.now()}`;
    const cantidadAgregada = Number(cantidad);
    const detalleExistente =
      recurso.tipo === "material"
        ? selected.apuDetalles?.find((detalle) => detalle.recursoId === recurso.id)
        : undefined;
    const detalleOptimista: ApuDetalle = detalleExistente
      ? {
          ...detalleExistente,
          cantidadPorUnidad:
            Number(detalleExistente.cantidadPorUnidad) + cantidadAgregada,
        }
      : {
          id: detalleOptimistaId,
          recursoId: recurso.id,
          cantidadPorUnidad: cantidadAgregada,
          recurso,
        };
    setSavingApuItem(true);
    setError("");
    setMensaje("");
    setSelected((actual) => {
      if (!actual || actual.id !== actividadId) return actual;
      const detalles = actual.apuDetalles ?? [];
      return {
        ...actual,
        apuDetalles: detalleExistente
          ? detalles.map((detalle) =>
              detalle.id === detalleExistente.id ? detalleOptimista : detalle,
            )
          : [...detalles, detalleOptimista],
      };
    });

    try {
      const { data } = await api.post<ApuMutationResponse>("/apus", {
        actividadId,
        recursoId,
        cantidadPorUnidad: cantidadAgregada,
      });
      setSelected((actual) => {
        if (!actual || actual.id !== actividadId) return actual;
        const detalles = (actual.apuDetalles ?? []).filter(
          (detalle) =>
            detalle.id !== detalleOptimistaId && detalle.id !== data.id,
        );
        return {
          ...actual,
          apuDetalles: [...detalles, data],
          apuCostoCache: data.apuCostoCache,
        };
      });
      setMensaje("Recurso agregado al APU correctamente.");
      setRecursoId("");
      setCantidad("1");
    } catch (err: unknown) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setSelected((actual) => {
        if (!actual || actual.id !== actividadId) return actual;
        return {
          ...actual,
          apuDetalles: detalleExistente
            ? (actual.apuDetalles ?? []).map((detalle) =>
                detalle.id === detalleExistente.id
                  ? detalleExistente
                  : detalle,
              )
            : (actual.apuDetalles ?? []).filter(
                (detalle) => detalle.id !== detalleOptimistaId,
              ),
        };
      });
      setError(
        message || "No se pudo agregar el recurso al APU.",);
    } finally {
      setSavingApuItem(false);
    }
  };

  const removeApuItem = async (apuId: string) => {
    if (!selected) return;
    try {
      const { data } = await api.delete<ApuDeleteResponse>(`/apus/${apuId}`);
      setSelected((actual) =>
        actual
          ? {
              ...actual,
              apuDetalles: actual.apuDetalles?.filter(
                (detalle) => detalle.id !== data.id,
              ),
              apuCostoCache: data.apuCostoCache,
            }
          : actual,
      );
      setMensaje("Recurso eliminado del APU.");
    } catch {
      setError("No se pudo eliminar el recurso del APU.");
    }
  };

  const abrirNuevaActividad = async () => {
    if (!(await loadBudgets())) return;
    setEditingActivityId(null);
    setEditingBudgetItemId(null);
    setActivityForm(EMPTY_ACTIVITY_FORM);
    setError("");
    setMensaje("");
    setActivityModalOpen(true);
  };

  const abrirEdicionActividad = async (activity: Activity) => {
    if (!(await loadBudgets())) return;
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

      await reloadActivities();
      setMensaje(
        editingActivityId
          ? "Actividad actualizada correctamente."
          : "Actividad agregada al proyecto y presupuesto. Su código y APU se generaron automáticamente.",
      );
      setActivityModalOpen(false);
    } catch (err: unknown) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(
        message || "No se pudo guardar la actividad.",
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
      await reloadActivities();
      setMensaje("Actividad quitada del proyecto y presupuesto.");
      setError("");
    } catch (err: unknown) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(
        message || "No se pudo eliminar la actividad.",
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
      let apuActualizado: ActivityApuData | null = null;

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
        const { data } = await api.patch<ApuMutationResponse>(
          `/apus/${detalleEditando.id}`,
          {
          cantidadPorUnidad: cantidadNueva,
          },
        );
        apuActualizado = {
          ...selected,
          apuDetalles: selected.apuDetalles?.map((detalle) =>
            detalle.id === data.id ? data : detalle,
          ),
          apuCostoCache: data.apuCostoCache,
        };
      }

      if (!apuActualizado) {
        const actualizado = await api.get<ActivityApuData>(
          `/apus/actividad/${selected.id}`,
        );
        apuActualizado = actualizado.data;
      }

      setSelected(apuActualizado);
      setMensaje("Precio y cantidad del recurso actualizados correctamente.");
      setDetalleEditando(null);
    } catch (err: unknown) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(
        message || "No se pudo completar la edición. Si se cambió el precio, verifica el catálogo de recursos.",
      );
    }
  };

  // Recursos filtrados según la sección activa (Materiales, Mano de Obra, Equipos/Transporte)
  const recursosDisponibles = useMemo(() => {
    return resources.filter((r) => {
      return tipoSeccion === "equipo_transporte"
        ? r.tipo === "equipo" || r.tipo === "transporte"
        : r.tipo === tipoSeccion;
    });
  }, [resources, tipoSeccion]);

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
            <p>{error || mensaje || "Seleccioná una actividad para configurar sus costos unitarios."}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="filter-group" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <FolderKanban size={18} color="#64748b" />
              <select
                className="text-input"
                style={{ width: "240px", padding: "8px" }}
                value={proyectoFiltro}
                onChange={(e) => {
                  setActivitiesLoading(true);
                  setPage(1);
                  setProyectoFiltro(e.target.value);
                }}
              >
                <option value="ALL">Todos los proyectos ({totalActivities})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <button
              className="primary-button"
              onClick={() => void abrirNuevaActividad()}
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
              {items.map((x) => {
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
                      <button
                        className="text-link"
                        onClick={() => void openApu(x.id, true)}
                        disabled={loadingApuId !== null}
                      >
                        Configurar APU
                      </button>
                      <button
                        className="text-link"
                        onClick={() => void abrirEdicionActividad(x)}
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
              {activitiesLoading && (
                <tr>
                  <td colSpan={6}>Cargando actividades...</td>
                </tr>
              )}
              {!activitiesLoading && !items.length && (
                <tr>
                  <td colSpan={6}>No hay actividades registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </HorizontalTable>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
          <span>
            {totalActivities === 0
              ? "Sin actividades"
              : `Mostrando ${(page - 1) * ACTIVITY_PAGE_SIZE + 1}-${Math.min(page * ACTIVITY_PAGE_SIZE, totalActivities)} de ${totalActivities}`}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary-button"
              onClick={() => {
                setActivitiesLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={page === 1 || activitiesLoading}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setActivitiesLoading(true);
                setPage((current) => current + 1);
              }}
              disabled={page * ACTIVITY_PAGE_SIZE >= totalActivities || activitiesLoading}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {loadingApuId && (
        <section className="panel" role="status">
          Cargando APU...
        </section>
      )}

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
              onClick={() => changeResourceSection("material")}
            >
              1. Materiales
            </button>
            <button
              className={tipoSeccion === "mano_obra" ? "primary-button" : "secondary-button"}
              onClick={() => changeResourceSection("mano_obra")}
            >
              2. Mano de Obra
            </button>
            <button
              className={tipoSeccion === "equipo_transporte" ? "primary-button" : "secondary-button"}
              onClick={() => changeResourceSection("equipo_transporte")}
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
                onChange={(e) => {
                  setResources([]);
                  setResourcesLoading(true);
                  setBusquedaRecurso(e.target.value);
                }}
              />
            </div>
            <div className="filter-input-wrapper">
              <Filter size={16} />
              <select
                className="text-input"
                value={categoriaFiltro}
                onChange={(e) => {
                  setResources([]);
                  setResourcesLoading(true);
                  setCategoriaFiltro(e.target.value);
                }}
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
                <option value="">
                  {resourcesLoading
                    ? "Buscando recursos..."
                    : recursosDisponibles.length
                    ? "-- Seleccionar de la lista --"
                    : busquedaRecursoAplicada
                      ? "No se encontraron recursos"
                      : "No hay recursos disponibles"}
                </option>
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
            <button
              className="primary-button add-apu-btn"
              onClick={() => void addApuItem()}
              disabled={savingApuItem || !recursoId}
            >
              <Plus size={16} /> {savingApuItem ? "Agregando..." : "Agregar a la partida"}
            </button>
          </div>

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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y cantidad">
                          <Pencil size={15} />
                        </button>
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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y horas">
                          <Pencil size={15} />
                        </button>
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
                        <button className="text-link" onClick={() => iniciarEdicion(det)} title="Editar precio y cantidad">
                          <Pencil size={15} />
                        </button>
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
