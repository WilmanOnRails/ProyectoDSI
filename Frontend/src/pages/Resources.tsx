import { useEffect, useState, useMemo } from "react";
import { Package, Search, Filter, Edit3 } from "lucide-react";
import api from "../services/api";

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

export default function Resources() {
  const [items, setItems] = useState<Resource[]>([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("ALL");
  const [categoriaFiltro, setCategoriaFiltro] = useState("ALL");
  const [editando, setEditando] = useState<Resource | null>(null);

  const loadResources = () => {
    api
      .get<Resource[]>("/recursos")
      .then((r) => {
        setItems(r.data);
        setError("");
      })
      .catch(() => setError("No se pudieron cargar los recursos."));
  };

  useEffect(() => {
    loadResources();
  }, []);

  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      await api.patch(`/recursos/${editando.id}`, {
        descripcion: editando.descripcion,
        categoria: editando.categoria,
        unidad: editando.unidad,
      });
      setMensaje("Recurso actualizado correctamente.");
      setEditando(null);
      loadResources();
    } catch {
      setError("No se pudo actualizar el recurso.");
    }
  };

  const categoriasUnicas = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => {
      if (r.categoria) set.add(r.categoria);
    });
    return Array.from(set).sort();
  }, [items]);

  const recursosFiltrados = useMemo(() => {
    return items.filter((r) => {
      const matchTipo = tipoFiltro === "ALL" || r.tipo === tipoFiltro;
      const matchCat = categoriaFiltro === "ALL" || r.categoria === categoriaFiltro;
      const texto = busqueda.toLowerCase();
      const matchTexto =
        !busqueda ||
        r.codigo.toLowerCase().includes(texto) ||
        (r.descripcion || "").toLowerCase().includes(texto) ||
        (r.categoria || "").toLowerCase().includes(texto);
      return matchTipo && matchCat && matchTexto;
    });
  }, [items, busqueda, tipoFiltro, categoriaFiltro]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGOS Y PRECIOS</p>
          <h1>Recursos, Mano de Obra, Equipos y Transporte</h1>
          <p className="muted">Catálogo único de costos del sistema ({items.length} recursos disponibles).</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Catálogo de recursos ({recursosFiltrados.length})</h2>
            <p>{error || "Cargados automáticamente al iniciar el sistema."}</p>
          </div>
          <Package size={28} />
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
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="filter-input-wrapper">
            <Filter size={16} />
            <select
              className="text-input"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
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
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper" style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>U.M.</th>
                <th>Precio Unitario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recursosFiltrados.map((x) => (
                <tr key={x.id}>
                  <td><span className="badge">{x.tipo}</span></td>
                  <td className="code-cell">{x.codigo}</td>
                  <td><strong>{x.descripcion}</strong></td>
                  <td>{x.categoria || "—"}</td>
                  <td>{x.unidad}</td>
                  <td>C$ {Number(x.costoUnitario || 0).toFixed(2)}</td>
                  <td>
                    <button className="text-link" onClick={() => setEditando(x)} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Edit3 size={14} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!recursosFiltrados.length && (
                <tr>
                  <td colSpan={7}>No hay recursos registrados que coincidan con los filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editando && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <h3>Editar Recurso ({editando.codigo})</h3>
            <div style={{ display: "grid", gap: "12px", marginTop: "15px" }}>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Descripción
                <input
                  className="text-input"
                  value={editando.descripcion}
                  onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                />
              </label>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Categoría
                <input
                  className="text-input"
                  value={editando.categoria || ""}
                  onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}
                />
              </label>
              <label style={{ display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600 }}>
                Unidad de Medida (U.M.)
                <input
                  className="text-input"
                  value={editando.unidad}
                  onChange={(e) => setEditando({ ...editando, unidad: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="secondary-button" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="primary-button" onClick={() => void guardarEdicion()}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
