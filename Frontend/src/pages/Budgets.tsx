
import { FileSpreadsheet, Plus } from "lucide-react";

export default function Budgets() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">CONTROL DE COSTOS</p>
                    <h1>Presupuestos</h1>
                    <p className="muted">Prepará y consultá presupuestos de construcción.</p>
                </div>
                <button className="primary-button" onClick={() => alert("Próximamente: elaborar presupuesto")}>
                    <Plus size={18} /> Nuevo presupuesto
                </button>
            </div>
            <section className="empty-state panel">
                <FileSpreadsheet size={38} />
                <h2>Presupuestos de obra</h2>
                <p>Esta sección reunirá los análisis de precios unitarios, los costos por actividad, los totales y la exportación a Excel.</p>
            </section>
        </>
    );
}
