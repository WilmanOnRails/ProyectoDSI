
import { FolderKanban, Plus } from "lucide-react";

export default function Projects() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">GESTIÓN</p>
                    <h1>Proyectos de construcción</h1>
                    <p className="muted">Organizá las obras y sus documentos.</p>
                </div>
                <button className="primary-button" onClick={() => alert("Próximamente: crear proyecto")}>
                    <Plus size={18} /> Nuevo proyecto
                </button>
            </div>
            <section className="empty-state panel">
                <FolderKanban size={38} />
                <h2>Gestioná tus proyectos</h2>
                <p>En esta sección podrás registrar obras, cargar documentos PDF y consultar su información.</p>
            </section>
        </>
    );
}
