
import { ClipboardList } from "lucide-react";

export default function Activities() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">CATÁLOGO DE OBRA</p>
                    <h1>Actividades</h1>
                    <p className="muted">Revisá las partidas extraídas de los documentos.</p>
                </div>
            </div>
            <section className="empty-state panel">
                <ClipboardList size={38} />
                <h2>Actividades de construcción</h2>
                <p>Más adelante podrás importar actividades desde PDF, corregir cantidades y unidades, y preparar sus análisis de precios unitarios.</p>
            </section>
        </>
    );
}
