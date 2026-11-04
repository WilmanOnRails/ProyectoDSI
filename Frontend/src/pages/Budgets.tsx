import React, { useEffect, useState, useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import api from "../services/api";

type Item = {
  id: string;
  cantidadProyecto: string | number;
  costoUnitarioCongelado: string | number;
  costoMaterialesCong: string | number;
  costoManoObraCong: string | number;
  costoEquipoCong: string | number;
  costoTransporteCong: string | number;
  total: string | number;
  // Campos calculados por el backend: P.U. = Total / Cantidad.
  totalMateriales?: string | number;
  totalManoObra?: string | number;
  totalEquipo?: string | number;
  totalTransporte?: string | number;
  sumaTotal?: string | number;
  puMateriales?: string | number;
  puManoObra?: string | number;
  puEquipo?: string | number;
  puTransporte?: string | number;
  puTotal?: string | number;
  actividad: {
    codigo: string;
    nombre: string;
    unidad: string;
    capituloCodigo?: string;
    capituloNombre?: string;
  };
};

type Budget = {
  id: string;
  nombre?: string;
  numero?: string;
  total: string | number;
  costosDirectos: string | number;
  indirectos: string | number;
  administracion: string | number;
  utilidad: string | number;
  imprevistos: string | number;
  subtotalNeto: string | number;
  impuestos: string | number;
  proyecto?: { nombre: string; cliente?: string; ubicacion?: string };
  items?: Item[];
};

const money = (v: string | number) =>
  `C$ ${Number(v || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Redondea a 2 decimales igual que el backend (Decimal ROUND_HALF_UP). */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function Budgets() {
  const [items, setItems] = useState<Budget[]>([]);
  const [selected, setSelected] = useState<Budget | null>(null);
  const [error, setError] = useState("");

  const loadBudgets = () => {
    api
      .get<Budget[]>("/presupuestos")
      .then((r) => setItems(r.data))
      .catch(() => setError("No se pudieron cargar los presupuestos."));
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const open = async (id: string) => {
    try {
      const res = await api.get<Budget>(`/presupuestos/${id}`);
      setSelected(res.data);
      setError("");
    } catch {
      setError("No se pudo cargar el detalle del presupuesto.");
    }
  };

  const exportExcel = async (id: string) => {
    try {
      const res = await api.get(`/presupuestos/${id}/excel`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `presupuesto-${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("No se pudo exportar el archivo Excel.");
    }
  };

  const itemsAgrupadosPorCapitulo = useMemo(() => {
    if (!selected?.items) return [];
    const map = new Map<string, { capituloNombre: string; items: Item[] }>();

    selected.items.forEach((item) => {
      const capKey = item.actividad.capituloNombre || item.actividad.capituloCodigo || "000 - GENERAL";
      if (!map.has(capKey)) {
        map.set(capKey, { capituloNombre: capKey, items: [] });
      }
      map.get(capKey)?.items.push(item);
    });

    return Array.from(map.entries()).map(([capKey, data]) => {
      const totalMatItem = (i: Item) =>
      i.totalMateriales !== undefined
        ? Number(i.totalMateriales)
        : r2(Number(i.puMateriales) * Number(i.cantidadProyecto));
      const totalMoItem = (i: Item) =>
        i.totalManoObra !== undefined
          ? Number(i.totalManoObra)
          : r2(Number(i.puManoObra) * Number(i.cantidadProyecto));
      const totalEqItem = (i: Item) =>
        i.totalEquipo !== undefined
          ? Number(i.totalEquipo)
          : r2(Number(i.puEquipo) * Number(i.cantidadProyecto));
      const totalTrItem = (i: Item) =>
        i.totalTransporte !== undefined
          ? Number(i.totalTransporte)
          : r2(Number(i.puTransporte) * Number(i.cantidadProyecto));

      const subMat = data.items.reduce((acc, i) => acc + totalMatItem(i), 0);
      const subMo = data.items.reduce((acc, i) => acc + totalMoItem(i), 0);
      const subEq = data.items.reduce((acc, i) => acc + totalEqItem(i), 0);
      const subTr = data.items.reduce((acc, i) => acc + totalTrItem(i), 0);
      const subTotal = r2(subMat + subMo + subEq + subTr);

      return {
        capituloNombre: capKey,
        items: data.items,
        subtotalMateriales: subMat,
        subtotalManoDeObra: subMo,
        subtotalEquipos: subEq,
        subtotalTransporte: subTr,
        subtotalGeneral: subTotal,
      };
    });
  }, [selected]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONTROL DE COSTOS</p>
          <h1>Presupuestos</h1>
          <p className="muted">Desglose horizontal por capítulos, costos directos y cálculo en cascada de indirectos, administración, utilidad e impuestos.</p>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h2>Presupuestos registrados ({items.length})</h2>
            <p>{error || "Seleccioná un presupuesto para ver el desglose completo."}</p>
          </div>
          <FileSpreadsheet size={28} />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proyecto</th>
                <th>Actividades</th>
                <th>Total General</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>{x.nombre || "Sin nombre"}</td>
                  <td>{x.proyecto?.nombre || "—"}</td>
                  <td>{x.items?.length || 0}</td>
                  <td><strong>{money(x.total)}</strong></td>
                  <td>
                    <button className="text-link" onClick={() => void open(x.id)}>
                      Ver desglose
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5}>No hay presupuestos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="panel data-panel budget-detail" style={{ maxWidth: "100%", overflowX: "auto" }}>
          <div className="panel-heading">
            <div>
              <h2>{selected.nombre}</h2>
              <p>{selected.proyecto?.nombre} · {selected.proyecto?.ubicacion || "Ubicación no indicada"}</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                className="primary-button"
                onClick={() => void exportExcel(selected.id)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={16} /> Exportar Excel
              </button>
              <button className="secondary-button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </div>

          {error && <div className="import-error">{error}</div>}

          <div className="table-wrapper" style={{ marginTop: "14px", overflowX: "auto" }}>
            <table style={{ minWidth: "1400px", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Ítem</th>
                  <th rowSpan={2}>Descripción</th>
                  <th rowSpan={2}>U.M.</th>
                  <th rowSpan={2}>Cantidad</th>
                  <th colSpan={5} style={{ textAlign: "center", background: "#e2e8f0" }}>Costos Unitarios</th>
                  <th colSpan={5} style={{ textAlign: "center", background: "#cbd5e1" }}>Costos Totales</th>
                </tr>
                <tr>
                  <th>P.U. Mat.</th>
                  <th>P.U. M.O.</th>
                  <th>P.U. Eq.</th>
                  <th>P.U. Trans.</th>
                  <th>P.U. Total</th>
                  <th>Total Mat.</th>
                  <th>Total M.O.</th>
                  <th>Total Eq.</th>
                  <th>Total Trans.</th>
                  <th>Suma Total</th>
                </tr>
              </thead>
              <tbody>
                {itemsAgrupadosPorCapitulo.map((cap) => (
                  <React.Fragment key={`cap-${cap.capituloNombre}`}>
                    <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                      <td colSpan={14} style={{ color: "#1e293b", padding: "10px" }}>
                        CAPÍTULO: {cap.capituloNombre}
                      </td>
                    </tr>
                    {cap.items.map((x, i) => {
                      const cant = Number(x.cantidadProyecto || 0);

                      // El backend ya devuelve los totales y las P.U.
                      // P.U. = Total de la categoría / Cantidad.
                      const totMat =
                        x.totalMateriales !== undefined
                          ? Number(x.totalMateriales)
                          : r2(Number(x.costoMaterialesCong || 0) * cant);

// Use the P.U. Mat value that the backend calculated (Total / Cantidad).
// This ensures consistency between P.U. and Total columns.
                      const totalMatDisplay =
                        x.puMateriales !== undefined
                          ? r2(Number(x.puMateriales) * cant)
                          : totMat;
                      // Use the P.U. values for the other cost categories, also multiplied by quantity
                      // to ensure consistency between P.U. and Total columns.
                      const totMo =
                        x.puManoObra !== undefined
                          ? r2(Number(x.puManoObra) * cant)
                          : r2(Number(x.costoManoObraCong || 0) * cant);
                      const totEq =
                        x.puEquipo !== undefined
                          ? r2(Number(x.puEquipo) * cant)
                          : r2(Number(x.costoEquipoCong || 0) * cant);
                      const totTr =
                        x.puTransporte !== undefined
                          ? r2(Number(x.puTransporte) * cant)
                          : r2(Number(x.costoTransporteCong || 0) * cant);

                      const puMat =
                        x.puMateriales !== undefined
                          ? Number(x.puMateriales)
                          : cant > 0
                            ? totMat / cant
                            : 0;
                      const puMo =
                        x.puManoObra !== undefined
                          ? Number(x.puManoObra)
                          : cant > 0
                            ? totMo / cant
                            : 0;
                      const puEq =
                        x.puEquipo !== undefined
                          ? Number(x.puEquipo)
                          : cant > 0
                            ? totEq / cant
                            : 0;
                      const puTr =
                        x.puTransporte !== undefined
                          ? Number(x.puTransporte)
                          : cant > 0
                            ? totTr / cant
                            : 0;

                      // Suma Total = Total Mat + Total M.O. + Total Eq. + Total Trans.
                      // Usamos los valores Total* que ya calculamos (pu* × cantidad).
                      const totalMatValue = x.totalMateriales !== undefined ? Number(x.totalMateriales) : r2(totMat);
                      const totalMoValue = x.totalManoObra !== undefined ? Number(x.totalManoObra) : r2(totMo);
                      const totalEqValue = x.totalEquipo !== undefined ? Number(x.totalEquipo) : r2(totEq);
                      const totalTrValue = x.totalTransporte !== undefined ? Number(x.totalTransporte) : r2(totTr);
                      const totGen = r2(totalMatValue + totalMoValue + totalEqValue + totalTrValue);
                      const puTot =
                        x.puTotal !== undefined
                          ? Number(x.puTotal)
                          : cant > 0
                            ? totGen / cant
                            : 0;

                      return (
                        <tr key={x.id}>
                          <td className="code-cell">{x.actividad.codigo || String(i + 1)}</td>
                          <td className="truncate-cell" title={x.actividad.nombre}>{x.actividad.nombre}</td>
                          <td>{x.actividad.unidad}</td>
                          <td>{cant}</td>
                          <td>{money(puMat)}</td>
                          <td>{money(puMo)}</td>
                          <td>{money(puEq)}</td>
                          <td>{money(puTr)}</td>
                          <td><strong>{money(puTot)}</strong></td>
                          <td>{money(totalMatDisplay)}</td>
                          <td>{money(totMo)}</td>
                          <td>{money(totEq)}</td>
                          <td>{money(totTr)}</td>
                          <td><strong>{money(totGen)}</strong></td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "#f8fafc", fontWeight: "bold", borderTop: "2px solid #cbd5e1" }}>
                      <td colSpan={9} style={{ textAlign: "right", color: "#334155" }}>
                        TOTAL CAPÍTULO — {cap.capituloNombre}:
                      </td>
                      <td>{money(cap.subtotalMateriales)}</td>
                      <td>{money(cap.subtotalManoDeObra)}</td>
                      <td>{money(cap.subtotalEquipos)}</td>
                      <td>{money(cap.subtotalTransporte)}</td>
                      <td><strong style={{ color: "#1d4ed8" }}>{money(cap.subtotalGeneral)}</strong></td>
                    </tr>
                  </React.Fragment>
                ))}
                {!selected.items?.length && (
                  <tr>
                    <td colSpan={14}>Este presupuesto no tiene ítems asociados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="financial-summary">
            <p>Costo directo: <strong>{money(selected.costosDirectos)}</strong></p>
            <p>Indirectos: <strong>{money(selected.indirectos)}</strong></p>
            <p>Administración: <strong>{money(selected.administracion)}</strong></p>
            <p>Utilidad: <strong>{money(selected.utilidad)}</strong></p>
            <p>Imprevistos: <strong>{money(selected.imprevistos)}</strong></p>
            <p>Subtotal neto: <strong>{money(selected.subtotalNeto)}</strong></p>
            <p>Impuestos: <strong>{money(selected.impuestos)}</strong></p>
            <p className="total-line">Precio total: <strong>{money(selected.total)}</strong></p>
          </div>
        </section>
      )}
    </>
  );
}
