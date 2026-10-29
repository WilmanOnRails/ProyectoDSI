
import { Package } from "lucide-react";

export default function Resources() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">CATÁLOGOS Y PRECIOS</p>
                    <h1>Recursos y precios</h1>
                    <p className="muted">Consultá los materiales y sus costos registrados.</p>
                </div>
            </div>
            <section className="empty-state panel">
                <Package size={38} />
                <h2>Catálogo de recursos</h2>
                <p>En esta sección gestionaremos materiales, mano de obra, equipos y transporte, además del historial de precios de materiales.</p>
            </section>
        </>
    );
}
