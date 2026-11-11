import { useEffect, useState, type ChangeEvent } from "react";
import { FileUp, LoaderCircle, Trash2 } from "lucide-react";
import api, { apiGet } from "../services/api";
import { canManagePlatformData } from "../services/authSession";

const ESTADOS_PROYECTO = [
  "En elaboración",
  "En ejecución",
  "Finalizado",
  "Cancelado",
] as const;

type Proyecto = { id: string; codigo?: string; nombre: string; cliente?: string; ubicacion?: string; estado?: string; };
type Resultado = { mensaje: string; proyecto: Proyecto; presupuesto: { id: string; nombre: string; cantidadActividades: number }; paginasProcesadas: number };

export default function Projects() {
  const canEdit = canManagePlatformData();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombrePresupuesto, setNombrePresupuesto] = useState("Presupuesto base - PLIEGO_1");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [proyectoAEliminar, setProyectoAEliminar] = useState<Proyecto | null>(null);
  const [estadosActualizando, setEstadosActualizando] = useState<Set<string>>(
    () => new Set(),
  );

  const cargarProyectos = async () => {
    try {
      setProyectos(await apiGet<Proyecto[]>("/projects"));
    } catch {
      setError("No se pudieron cargar los proyectos.");
    }
  };

  useEffect(() => {
    void cargarProyectos();
  }, []);

  const seleccionar = (e: ChangeEvent<HTMLInputElement>) => {
    setArchivo(e.target.files?.[0] ?? null);
    setError("");
    setResultado(null);
  };

  const importar = async () => {
    if (!archivo) { setError("Seleccioná un archivo PDF antes de importar."); return; }
    const form = new FormData();
    form.append("archivo", archivo);
    form.append("nombrePresupuesto", nombrePresupuesto);
    setCargando(true);
    setError("");
    try {
      const r = await api.post<Resultado>("/importaciones/pliego-pdf", form, { headers: { "Content-Type": "multipart/form-data" } });
      setResultado(r.data);
      setArchivo(null);
      await cargarProyectos();
    } catch (e: any) {
      const m = e.response?.data?.message;
      setError(Array.isArray(m) ? m.join(", ") : m || "No se pudo importar el PDF.");
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!proyectoAEliminar) return;
    try {
      await api.delete(`/projects/${proyectoAEliminar.id}`);
      setProyectoAEliminar(null);
      await cargarProyectos();
    } catch {
      setError("No se pudo eliminar el proyecto.");
      setProyectoAEliminar(null);
    }
  };

  const cambiarEstado = async (proyecto: Proyecto, estado: string) => {
    const estadoAnterior = proyecto.estado || "En elaboración";
    if (estado === estadoAnterior || estadosActualizando.has(proyecto.id)) return;

    setError("");
    setEstadosActualizando((actuales) => new Set(actuales).add(proyecto.id));
    setProyectos((actuales) =>
      actuales.map((actual) =>
        actual.id === proyecto.id ? { ...actual, estado } : actual,
      ),
    );

    try {
      await api.patch(`/projects/${proyecto.id}`, { estado });
    } catch (e: unknown) {
      const message = (
        e as { response?: { data?: { message?: string | string[] } } }
      ).response?.data?.message;
      setProyectos((actuales) =>
        actuales.map((actual) =>
          actual.id === proyecto.id
            ? { ...actual, estado: estadoAnterior }
            : actual,
        ),
      );
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || "No se pudo actualizar el estado del proyecto.",
      );
    } finally {
      setEstadosActualizando((actuales) => {
        const siguientes = new Set(actuales);
        siguientes.delete(proyecto.id);
        return siguientes;
      });
    }
  };

  const claseEstado = (estado: string) => {
    switch (estado) {
      case "En ejecución":
        return "status-en-proceso";
      case "Finalizado":
        return "status-finalizado";
      case "Cancelado":
        return "status-cancelado";
      default:
        return "status-en-elaboracion";
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN</p>
          <h1>Proyectos de construcción</h1>
          <p className="muted">Importá pliegos y consultá tus proyectos guardados.</p>
        </div>
      </div>

      {canEdit && <section className="panel import-card">
        <div className="panel-heading">
          <div>
            <h2>Importar pliego PDF</h2>
            <p>Se creará un proyecto, presupuesto y sus actividades.</p>
          </div>
          <FileUp size={28} />
        </div>
        <label className="file-label" htmlFor="pliego-pdf">Archivo PDF</label>
        <input id="pliego-pdf" type="file" accept="application/pdf" onChange={seleccionar} />
        {archivo && <p className="file-name">Archivo seleccionado: {archivo.name}</p>}
        <label className="file-label" htmlFor="nombre-presupuesto">Nombre del presupuesto</label>
        <input id="nombre-presupuesto" className="text-input" value={nombrePresupuesto} onChange={e => setNombrePresupuesto(e.target.value)} />
        <button className="primary-button" onClick={importar} disabled={cargando}>
          {cargando ? <LoaderCircle className="spin" size={18} /> : <FileUp size={18} />} {cargando ? "Procesando PDF..." : "Importar pliego"}
        </button>
        {error && <div className="import-error">{error}</div>}
        {resultado && (
          <div className="import-success">
            <strong>Importación completada correctamente</strong>
            <p>{resultado.proyecto.nombre}</p>
            <ul>
              <li>Presupuesto: {resultado.presupuesto.nombre}</li>
              <li>Actividades: {resultado.presupuesto.cantidadActividades}</li>
              <li>Páginas: {resultado.paginasProcesadas}</li>
            </ul>
          </div>
        )}
      </section>}

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Proyectos guardados ({proyectos.length})</h2>
            <p>Listado de proyectos registrados en el sistema.</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cliente</th>
                <th>Ubicación</th>
                <th>Estado</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {proyectos.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.cliente || "—"}</td>
                  <td>{p.ubicacion || "—"}</td>
                  <td>
                    {canEdit ? (
                      <select
                        className={`status status-select ${claseEstado(p.estado || "En elaboración")}`}
                        value={p.estado || "En elaboración"}
                        onChange={(event) =>
                          void cambiarEstado(p, event.target.value)
                        }
                        disabled={estadosActualizando.has(p.id)}
                        aria-label={`Cambiar estado de ${p.nombre}`}
                      >
                        {!ESTADOS_PROYECTO.includes(
                          p.estado as (typeof ESTADOS_PROYECTO)[number],
                        ) && p.estado && (
                          <option value={p.estado}>{p.estado}</option>
                        )}
                        {ESTADOS_PROYECTO.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`status ${claseEstado(p.estado || "En elaboración")}`}>
                        {p.estado || "En elaboración"}
                      </span>
                    )}
                  </td>
                  {canEdit && <td>
                    <button className="icon-btn-danger" onClick={() => setProyectoAEliminar(p)} title="Eliminar proyecto">
                      <Trash2 size={16} />
                    </button>
                  </td>}
                </tr>
              ))}
              {!proyectos.length && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4}>No hay proyectos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {proyectoAEliminar && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>¿Estás seguro de eliminar este proyecto?</h3>
            <p>Se eliminará el proyecto <strong>{proyectoAEliminar.nombre}</strong> y todos sus datos asociados.</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setProyectoAEliminar(null)}>No</button>
              <button className="primary-button" style={{ background: "#dc2626" }} onClick={confirmarEliminar}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
