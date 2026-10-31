import { useEffect, useState, type ChangeEvent } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import api from "../services/api";

type Proyecto = { id: string; codigo?: string; nombre: string; cliente?: string; ubicacion?: string; estado?: string; };
type Resultado = { mensaje: string; proyecto: Proyecto; presupuesto: { id: string; nombre: string; cantidadActividades: number }; paginasProcesadas: number };

export default function Projects() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombrePresupuesto, setNombrePresupuesto] = useState("Presupuesto base - PLIEGO_1");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const cargarProyectos = async () => { try { setProyectos((await api.get<Proyecto[]>("/projects")).data); } catch { setError("No se pudieron cargar los proyectos."); } };
  useEffect(() => { void cargarProyectos(); }, []);
  const seleccionar = (e: ChangeEvent<HTMLInputElement>) => { setArchivo(e.target.files?.[0] ?? null); setError(""); setResultado(null); };
  const importar = async () => {
    if (!archivo) { setError("Seleccioná un archivo PDF antes de importar."); return; }
    const form = new FormData(); form.append("archivo", archivo); form.append("nombrePresupuesto", nombrePresupuesto);
    setCargando(true); setError("");
    try { const r = await api.post<Resultado>("/importaciones/pliego-pdf", form, { headers: { "Content-Type": "multipart/form-data" } }); setResultado(r.data); setArchivo(null); await cargarProyectos(); }
    catch (e: any) { const m = e.response?.data?.message; setError(Array.isArray(m) ? m.join(", ") : m || "No se pudo importar el PDF."); }
    finally { setCargando(false); }
  };
  return <>
    <div className="page-heading"><div><p className="eyebrow">GESTIÓN</p><h1>Proyectos de construcción</h1><p className="muted">Importá pliegos y consultá tus proyectos guardados.</p></div></div>
    <section className="panel import-card"><div className="panel-heading"><div><h2>Importar pliego PDF</h2><p>Se creará un proyecto, presupuesto y sus actividades.</p></div><FileUp size={28}/></div>
      <label className="file-label" htmlFor="pliego-pdf">Archivo PDF</label><input id="pliego-pdf" type="file" accept="application/pdf" onChange={seleccionar}/>{archivo && <p className="file-name">Archivo seleccionado: {archivo.name}</p>}
      <label className="file-label" htmlFor="nombre-presupuesto">Nombre del presupuesto</label><input id="nombre-presupuesto" className="text-input" value={nombrePresupuesto} onChange={e => setNombrePresupuesto(e.target.value)}/>
      <button className="primary-button" onClick={importar} disabled={cargando}>{cargando ? <LoaderCircle className="spin" size={18}/> : <FileUp size={18}/>} {cargando ? "Procesando PDF..." : "Importar pliego"}</button>
      {error && <div className="import-error">{error}</div>}{resultado && <div className="import-success"><strong>Importación completada correctamente</strong><p>{resultado.proyecto.nombre}</p><ul><li>Presupuesto: {resultado.presupuesto.nombre}</li><li>Actividades: {resultado.presupuesto.cantidadActividades}</li><li>Páginas: {resultado.paginasProcesadas}</li></ul></div>}
    </section>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Proyectos guardados</h2><p>Estos datos vienen del backend.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Nombre</th><th>Cliente</th><th>Ubicación</th><th>Estado</th></tr></thead><tbody>{proyectos.map(p => <tr key={p.id}><td>{p.nombre}</td><td>{p.cliente || "—"}</td><td>{p.ubicacion || "—"}</td><td><span className="status status-en-proceso">{p.estado || "En elaboración"}</span></td></tr>)}{!proyectos.length && <tr><td colSpan={4}>No hay proyectos registrados.</td></tr>}</tbody></table></div></section>
  </>;
}
