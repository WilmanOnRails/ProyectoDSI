import React, { useEffect, useState, useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import api, { apiGet } from "../services/api";
import HorizontalTable from "../components/HorizontalTable";

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

type BudgetSummary = Pick<Budget, "id" | "nombre" | "numero" | "total" | "proyecto"> & {
  cantidadActividades: number;
};

type BudgetSummaryPage = {
  items: BudgetSummary[];
  total: number;
  pagina: number;
  limite: number;
};

const PAGE_SIZE = 25;

const money = (v: string | number) =>
  `C$ ${Number(v || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unitMoney = (v: string | number) => {
  const amount = Number(v || 0);
  const value =
    amount !== 0 && Math.abs(amount) < 0.001
      ? `<${(0.001).toLocaleString("es-NI", {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })}`
      : amount.toLocaleString("es-NI", { maximumFractionDigits: 3 });
  return `C$ ${value}`;
};
const quantityFormat = (v: number) =>
  v.toLocaleString("es-NI", { maximumFractionDigits: 3 });

const toCents = (value: string | number) => Math.round(Number(value || 0) * 100);
const fromCents = (value: number) => value / 100;
const sumMoney = (...values: (string | number)[]) =>
  fromCents(values.reduce<number>((sum, value) => sum + toCents(value), 0));
const lineTotal = (
  item: Item,
  total: string | number | undefined,
  pu: string | number | undefined,
  frozenCost: string | number,
) => {
  if (total !== undefined) return Number(total);
  const quantity = Number(item.cantidadProyecto || 0);
  const unitPrice =
    pu !== undefined
      ? Number(pu)
      : quantity > 0
        ? fromCents(toCents(frozenCost) / quantity)
        : 0;
  return fromCents(Math.round(toCents(unitPrice) * quantity));
};
const totalMatItem = (item: Item) =>
  lineTotal(item, item.totalMateriales, item.puMateriales, item.costoMaterialesCong);
const totalMoItem = (item: Item) =>
  lineTotal(item, item.totalManoObra, item.puManoObra, item.costoManoObraCong);
const totalEqItem = (item: Item) =>
  lineTotal(item, item.totalEquipo, item.puEquipo, item.costoEquipoCong);
const totalTrItem = (item: Item) =>
  lineTotal(item, item.totalTransporte, item.puTransporte, item.costoTransporteCong);

export default function Budgets() {
  const [items, setItems] = useState<BudgetSummary[]>([]);
  const [totalBudgets, setTotalBudgets] = useState(0);
  const [page, setPage] = useState(1);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<Budget | null>(null);
  const [error, setError] = useState("");
  const loading = loadedPage !== page;

  useEffect(() => {
    let active = true;
    apiGet<BudgetSummaryPage>("/presupuestos/resumen", {
      pagina: page,
      limite: PAGE_SIZE,
    })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotalBudgets(result.total);
        setError("");
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los presupuestos.");
      })
      .finally(() => {
        if (active) setLoadedPage(page);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const open = async (id: string) => {
    try {
      setSelected(await apiGet<Budget>(`/presupuestos/${id}`));
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
      const subMat = fromCents(data.items.reduce((sum, i) => sum + toCents(totalMatItem(i)), 0));
      const subMo = fromCents(data.items.reduce((sum, i) => sum + toCents(totalMoItem(i)), 0));
      const subEq = fromCents(data.items.reduce((sum, i) => sum + toCents(totalEqItem(i)), 0));
      const subTr = fromCents(data.items.reduce((sum, i) => sum + toCents(totalTrItem(i)), 0));
      const subTotal = sumMoney(subMat, subMo, subEq, subTr);

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
            <h2>Presupuestos registrados ({totalBudgets})</h2>
            <p>{error || "Seleccioná un presupuesto para ver el desglose completo."}</p>
          </div>
          <FileSpreadsheet size={28} />
        </div>
        <HorizontalTable>
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
                  <td>{x.cantidadActividades}</td>
                  <td><strong>{money(x.total)}</strong></td>
                  <td>
                    <button className="text-link" onClick={() => void open(x.id)}>
                      Ver desglose
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={5}>No hay presupuestos registrados.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5}>Cargando presupuestos...</td>
                </tr>
              )}
            </tbody>
          </table>
        </HorizontalTable>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
          <span>
            {totalBudgets === 0
              ? "Sin presupuestos"
              : `Mostrando ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalBudgets)} de ${totalBudgets}`}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              onClick={() => setPage((current) => current + 1)}
              disabled={page * PAGE_SIZE >= totalBudgets || loading}
            >
              Siguiente
            </button>
          </div>
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

          <HorizontalTable style={{ marginTop: "14px", overflowX: "auto" }}>
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
                      const totalMatDisplay = totalMatItem(x);
                      const totMo = totalMoItem(x);
                      const totEq = totalEqItem(x);
                      const totTr = totalTrItem(x);

                      const puMat =
                        x.puMateriales !== undefined
                          ? Number(x.puMateriales)
                          : cant > 0
                            ? totalMatDisplay / cant
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
                      const totGen = sumMoney(totalMatDisplay, totMo, totEq, totTr);
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
                          <td>{quantityFormat(cant)}</td>
                          <td>{unitMoney(puMat)}</td>
                          <td>{unitMoney(puMo)}</td>
                          <td>{unitMoney(puEq)}</td>
                          <td>{unitMoney(puTr)}</td>
                          <td><strong>{unitMoney(puTot)}</strong></td>
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
          </HorizontalTable>

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
