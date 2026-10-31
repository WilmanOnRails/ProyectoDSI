import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import api from "../services/api";

type Activity = { id: string; codigo: string; nombre: string; unidad: string };
export default function Activities() {
  const [items, setItems] = useState<Activity[]>([]); const [error, setError] = useState("");
  useEffect(() => { api.get<Activity[]>("/activities").then(r => setItems(r.data)).catch(() => setError("No se pudieron cargar las actividades.")); }, []);
  return <><div className="page-heading"><div><p className="eyebrow">CATÁLOGO DE OBRA</p><h1>Actividades</h1><p className="muted">Partidas extraídas de los documentos.</p></div></div><section className="panel data-panel"><div className="panel-heading"><div><h2>Actividades registradas ({items.length})</h2><p>{error || "Datos consultados desde el backend."}</p></div><ClipboardList size={28}/></div><div className="table-wrapper"><table><thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td className="code-cell">{x.codigo}</td><td>{x.nombre}</td><td>{x.unidad}</td></tr>)}{!items.length && <tr><td colSpan={3}>No hay actividades registradas.</td></tr>}</tbody></table></div></section></>;
}
