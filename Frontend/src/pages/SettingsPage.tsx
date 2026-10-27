
import { Settings } from "lucide-react";

export default function SettingsPage() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">SISTEMA</p>
                    <h1>Configuración</h1>
                    <p className="muted">Preferencias y opciones del sistema.</p>
                </div>
            </div>
            <section className="empty-state panel">
                <Settings size={38} />
                <h2>Configuración general</h2>
                <p>Más adelante añadiremos las opciones de cuenta, usuarios y permisos.</p>
            </section>
        </>
    );
}
