import { useEffect, useState } from "react";
import { Edit3, Filter, Package, Plus, Search, Trash2 } from "lucide-react";
import api, { apiGet } from "../services/api";
import HorizontalTable from "../components/HorizontalTable";
import { canManagePlatformData } from "../services/authSession";

type Resource = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  costoUnitario: string | number;
  categoria?: string;
  tipo: string;
  proveedor?: string;
};

type ResourceForm = {
  descripcion: string;
  tipo: string;
  categoria: string;
  categoriaNueva: string;
  unidad: string;
  unidadNueva: string;
  costoUnitario: string;
  proveedor: string;
};

type ResourcePage = {
  items: Resource[];
  total: number;
  pagina: number;
  limite: number;
};

type ResourceOptions = {
  categorias: string[];
  unidades: string[];
};

const NUEVA_OPCION = "__nueva__";
const PAGE_SIZE = 50;

const formularioVacio = (): ResourceForm => ({
  descripcion: "",
  tipo: "material",
  categoria: "",
  categoriaNueva: "",
  unidad: "",
  unidadNueva: "",
  costoUnitario: "",
  proveedor: "",
});

export default function Resources() {
  const canEdit = canManagePlatformData();
  const [items, setItems] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [opciones, setOpciones] = useState<ResourceOptions>({
    categorias: [],
    unidades: [],
  });
  const [consultaCargada, setConsultaCargada] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [errorAccion, setErrorAccion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("ALL");
  const [categoriaFiltro, setCategoriaFiltro] = useState("ALL");
  const [formulario, setFormulario] = useState<ResourceForm | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [recursoAEliminar, setRecursoAEliminar] = useState<Resource | null>(null);
  const [guardando, setGuardando] = useState(false);
  const consultaActual = JSON.stringify([
    pagina,
    tipoFiltro,
    categoriaFiltro,
    busquedaAplicada,
    recargar,
  ]);
  const cargando = consultaCargada !== consultaActual;

  useEffect(() => {
    const timer = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    let active = true;

    apiGet<ResourcePage>("/recursos", {
      activo: true,
      pagina,
      limite: PAGE_SIZE,
      ...(tipoFiltro !== "ALL" ? { tipo: tipoFiltro } : {}),
      ...(categoriaFiltro !== "ALL" ? { categoria: categoriaFiltro } : {}),
      ...(busquedaAplicada ? { buscar: busquedaAplicada } : {}),
    })
      .then((result) => {
        if (!active) return;
        if (result.items.length === 0 && result.total > 0 && pagina > 1) {
          setPagina(pagina - 1);
          return;
        }
        setItems(result.items);
        setTotal(result.total);
        setError("");
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los recursos.");
      })
      .finally(() => {
        if (active) setConsultaCargada(consultaActual);
      });

    return () => {
      active = false;
    };
  }, [pagina, tipoFiltro, categoriaFiltro, busquedaAplicada, recargar, consultaActual]);

  useEffect(() => {
    let active = true;
    apiGet<ResourceOptions>("/recursos/opciones")
      .then((result) => {
        if (active) setOpciones(result);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar las opciones de recursos.");
      });

    return () => {
      active = false;
    };
  }, [recargar]);

  const categoriasUnicas = opciones.categorias;
  const unidadesUnicas = opciones.unidades;

  const abrirNuevo = () => {
    setFormulario(formularioVacio());
    setEditandoId(null);
    setErrorAccion("");
    setMensaje("");
  };

  const abrirEdicion = (recurso: Resource) => {
    setFormulario({
      ...formularioVacio(),
      descripcion: recurso.descripcion,
      categoria: recurso.categoria || "",
      unidad: recurso.unidad,
    });
    setEditandoId(recurso.id);
    setErrorAccion("");
    setMensaje("");
  };

  const actualizarFormulario = (campo: keyof ResourceForm, valor: string) => {
    setFormulario((actual) => actual && { ...actual, [campo]: valor });
  };

  const guardarRecurso = async () => {
    if (!formulario || guardando) return;

    const descripcion = formulario.descripcion.trim();
    const categoria =
      formulario.categoria === NUEVA_OPCION
        ? formulario.categoriaNueva.trim()
        : formulario.categoria.trim();
    const unidad =
      formulario.unidad === NUEVA_OPCION
        ? formulario.unidadNueva.trim()
        : formulario.unidad.trim();

    if (!descripcion || !unidad || (formulario.categoria === NUEVA_OPCION && !categoria)) {
      setErrorAccion("Completá la descripción, la unidad de medida y la nueva categoría seleccionada.");
      return;
    }

    const costoUnitario = Number(formulario.costoUnitario);
    if (!editandoId && (!Number.isFinite(costoUnitario) || costoUnitario < 0 || !/^\d+(\.\d{1,2})?$/.test(formulario.costoUnitario))) {
      setErrorAccion("Ingresá un precio válido con hasta dos decimales.");
      return;
    }

    setGuardando(true);
    setErrorAccion("");
    try {
      if (editandoId) {
        await api.patch(`/recursos/${editandoId}`, {
          descripcion,
          categoria: categoria || null,
          unidad,
        });
        setMensaje("Recurso actualizado correctamente.");
      } else {
        await api.post("/recursos", {
          descripcion,
          tipo: formulario.tipo,
          categoria: categoria || undefined,
          unidad,
          costoUnitario,
          proveedor: formulario.proveedor.trim() || undefined,
        });
        setMensaje("Recurso agregado correctamente.");
      }
      setFormulario(null);
      setEditandoId(null);
      setRecargar((actual) => actual + 1);
      setPagina(1);
    } catch {
      setErrorAccion(editandoId ? "No se pudo actualizar el recurso." : "No se pudo agregar el recurso.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!recursoAEliminar || guardando) return;
    setGuardando(true);
    setErrorAccion("");
    try {
      await api.delete(`/recursos/${recursoAEliminar.id}`);
      setMensaje("Recurso eliminado del catálogo.");
      setRecursoAEliminar(null);
      setRecargar((actual) => actual + 1);
    } catch {
      setErrorAccion("No se pudo eliminar el recurso.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGOS Y PRECIOS</p>
          <h1>Recursos, Mano de Obra, Equipos y Transporte</h1>
          <p className="muted">Catálogo único de costos del sistema ({total} recursos disponibles).</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Catálogo de recursos ({total})</h2>
            <p>{error || "Cargados automáticamente al iniciar el sistema."}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Package size={28} />
            {canEdit && (
              <button className="primary-button" onClick={abrirNuevo}>
                <Plus size={16} /> Agregar recurso
              </button>
            )}
          </div>
        </div>

        {mensaje && <div className="import-success" style={{ margin: "15px 24px 0" }}>{mensaje}</div>}
        {error && <div className="import-error" style={{ margin: "15px 24px 0" }}>{error}</div>}

        <div className="apu-search-bar" style={{ padding: "16px 24px 0", gridTemplateColumns: "2fr 1fr 1fr" }}>
          <div className="search-input-wrapper">
            <Search size={16} />
            <input
              type="text"
              className="text-input"
              placeholder="Buscar recurso..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>
          <div className="filter-input-wrapper">
            <Filter size={16} />
            <select
              className="text-input"
              value={tipoFiltro}
              onChange={(e) => {
                setTipoFiltro(e.target.value);
                setPagina(1);
              }}
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
              onChange={(e) => {
                setCategoriaFiltro(e.target.value);
                setPagina(1);
              }}
            >
              <option value="ALL">Todas las categorías</option>
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <HorizontalTable style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>U.M.</th>
                <th>Precio Unitario</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td><span className="badge">{x.tipo}</span></td>
                  <td className="code-cell">{x.codigo}</td>
                  <td><strong>{x.descripcion}</strong></td>
                  <td>{x.categoria || "—"}</td>
                  <td>{x.unidad}</td>
                  <td>C$ {Number(x.costoUnitario || 0).toFixed(2)}</td>
                  {canEdit && <td style={{ whiteSpace: "nowrap" }}>
                    <button className="text-link" onClick={() => abrirEdicion(x)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginRight: "12px" }}>
                      <Edit3 size={14} /> Editar
                    </button>
                    <button className="icon-btn-danger" onClick={() => { setErrorAccion(""); setRecursoAEliminar(x); }} title="Eliminar recurso">
                      <Trash2 size={16} />
                    </button>
                  </td>}
                </tr>
              ))}
              {!cargando && !items.length && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6}>No hay recursos registrados que coincidan con los filtros.</td>
                </tr>
              )}
              {cargando && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6}>Cargando recursos...</td>
                </tr>
              )}
            </tbody>
          </table>
        </HorizontalTable>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
          <span>
            {total === 0
              ? "Sin recursos"
              : `Mostrando ${(pagina - 1) * PAGE_SIZE + 1}-${Math.min(pagina * PAGE_SIZE, total)} de ${total}`}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary-button"
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              disabled={pagina === 1 || cargando}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              onClick={() => setPagina((actual) => actual + 1)}
              disabled={pagina * PAGE_SIZE >= total || cargando}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {formulario && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <h3>{editandoId ? "Editar recurso" : "Agregar recurso"}</h3>
            <div style={{ display: "grid", gap: "12px", marginTop: "15px" }}>
              {!editandoId && (
                <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                  Tipo de recurso
                  <select className="text-input" value={formulario.tipo} onChange={(e) => actualizarFormulario("tipo", e.target.value)}>
                    <option value="material">Materiales</option>
                    <option value="mano_obra">Mano de Obra</option>
                    <option value="equipo">Equipos</option>
                    <option value="transporte">Transporte</option>
                  </select>
                </label>
              )}
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Descripción
                <input
                  className="text-input"
                  value={formulario.descripcion}
                  onChange={(e) => actualizarFormulario("descripcion", e.target.value)}
                  maxLength={200}
                />
              </label>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Categoría
                <select className="text-input" value={formulario.categoria} onChange={(e) => actualizarFormulario("categoria", e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categoriasUnicas.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                  <option value={NUEVA_OPCION}>Agregar nueva categoría...</option>
                </select>
              </label>
              {formulario.categoria === NUEVA_OPCION && (
                <input
                  className="text-input"
                  placeholder="Nombre de la nueva categoría"
                  value={formulario.categoriaNueva}
                  onChange={(e) => actualizarFormulario("categoriaNueva", e.target.value)}
                  maxLength={100}
                />
              )}
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Unidad de Medida (U.M.)
                <select className="text-input" value={formulario.unidad} onChange={(e) => actualizarFormulario("unidad", e.target.value)}>
                  <option value="">Seleccioná una unidad</option>
                  {unidadesUnicas.map((unidad) => <option key={unidad} value={unidad}>{unidad}</option>)}
                  <option value={NUEVA_OPCION}>Agregar nueva unidad...</option>
                </select>
              </label>
              {formulario.unidad === NUEVA_OPCION && (
                <input
                  className="text-input"
                  placeholder="Nombre de la nueva unidad"
                  value={formulario.unidadNueva}
                  onChange={(e) => actualizarFormulario("unidadNueva", e.target.value)}
                  maxLength={30}
                />
              )}
              {!editandoId && (
                <>
                  <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                    Precio unitario (C$)
                    <input
                      className="text-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formulario.costoUnitario}
                      onChange={(e) => actualizarFormulario("costoUnitario", e.target.value)}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                    Proveedor (opcional)
                    <input
                      className="text-input"
                      value={formulario.proveedor}
                      onChange={(e) => actualizarFormulario("proveedor", e.target.value)}
                      maxLength={100}
                    />
                  </label>
                </>
              )}
            </div>
            {errorAccion && <div className="import-error" style={{ marginTop: "14px" }}>{errorAccion}</div>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="secondary-button" onClick={() => { setFormulario(null); setEditandoId(null); }} disabled={guardando}>Cancelar</button>
              <button className="primary-button" onClick={() => void guardarRecurso()} disabled={guardando}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar recurso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {recursoAEliminar && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>¿Estás seguro de eliminar este recurso?</h3>
            <p>Se quitará del catálogo activo <strong>{recursoAEliminar.descripcion}</strong>. Los registros históricos y APUs asociados se conservarán.</p>
            {errorAccion && <div className="import-error" style={{ marginBottom: "14px" }}>{errorAccion}</div>}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setRecursoAEliminar(null)} disabled={guardando}>Cancelar</button>
              <button className="primary-button" style={{ background: "#dc2626" }} onClick={() => void confirmarEliminar()} disabled={guardando}>
                {guardando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
