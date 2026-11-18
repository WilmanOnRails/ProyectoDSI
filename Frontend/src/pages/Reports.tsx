import { useState } from "react";
import { Download, FileSpreadsheet, Package } from "lucide-react";
import api from "../services/api";
import { useAlert } from "../components/Alerts";
import { Spinner } from "../components/Loading";

type TipoRecurso = "material" | "mano_obra" | "equipo" | "transporte";

const tipos: { value: TipoRecurso | ""; label: string }[] = [
    { value: "", label: "Todos los tipos" },
    { value: "material", label: "Materiales" },
    { value: "mano_obra", label: "Mano de obra" },
    { value: "equipo", label: "Equipo" },
    { value: "transporte", label: "Transporte" },
];

export default function Reports() {
    const { mostrarExito, mostrarError } = useAlert();
    const [descargando, setDescargando] = useState<string | null>(null);
    const [tipo, setTipo] = useState<TipoRecurso | "">("");
    const [activo, setActivo] = useState("");

    async function descargar(
        clave: string,
        ruta: string,
        nombreArchivo: string,
        params?: Record<string, string>,
    ) {
        if (descargando) return;

        setDescargando(clave);
        try {
            const respuesta = await api.get(ruta, {
                responseType: "blob",
                params,
            });
            const url = window.URL.createObjectURL(new Blob([respuesta.data]));
            const enlace = document.createElement("a");
            enlace.href = url;
            enlace.download = `${nombreArchivo}.xlsx`;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            window.URL.revokeObjectURL(url);
            mostrarExito("Reporte descargado correctamente.");
        } catch {
            mostrarError("No se pudo generar el reporte. Intentá de nuevo.");
        } finally {
            setDescargando(null);
        }
    }

    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">INFORMES</p>
                    <h1>Reportes</h1>
                    <p className="muted">
                        Descargá el resumen del sistema o el catálogo de precios en Excel.
                    </p>
                </div>
            </div>

            <div className="reportes-grid">
                <section className="panel reporte-card">
                    <div className="reporte-icono">
                        <FileSpreadsheet size={24} />
                    </div>
                    <div className="reporte-cuerpo">
                        <h2>Resumen general</h2>
                        <p className="muted">
                            Los indicadores del dashboard en Excel: proyectos, presupuestos,
                            actividades, valor presupuestado, distribución de costos y el
                            detalle completo por proyecto.
                        </p>
                    </div>
                    <button
                        className="primary-button"
                        type="button"
                        onClick={() => void descargar(
                            "resumen",
                            "/reportes/resumen",
                            "reporte-resumen",
                        )}
                        disabled={descargando !== null}
                    >
                        {descargando === "resumen" ? <Spinner size={16} /> : <Download size={16} />}
                        Descargar Excel
                    </button>
                </section>

                <section className="panel reporte-card">
                    <div className="reporte-icono">
                        <Package size={24} />
                    </div>
                    <div className="reporte-cuerpo">
                        <h2>Catálogo de recursos y precios</h2>
                        <p className="muted">
                            Todos los recursos con su precio vigente, el último precio
                            registrado y la fecha en que cambió.
                        </p>
                    </div>
                    <div className="reporte-filtros">
                        <label>
                            Tipo
                            <select
                                className="text-input"
                                value={tipo}
                                onChange={(event) => setTipo(event.target.value as TipoRecurso | "")}
                                disabled={descargando !== null}
                            >
                                {tipos.map((opcion) => (
                                    <option key={opcion.value} value={opcion.value}>
                                        {opcion.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Estado
                            <select
                                className="text-input"
                                value={activo}
                                onChange={(event) => setActivo(event.target.value)}
                                disabled={descargando !== null}
                            >
                                <option value="">Todos</option>
                                <option value="true">Activos</option>
                                <option value="false">Inactivos</option>
                            </select>
                        </label>
                    </div>
                    <button
                        className="primary-button"
                        type="button"
                        onClick={() => void descargar(
                            "catalogo",
                            "/reportes/catalogo-recursos",
                            "reporte-catalogo-recursos",
                            {
                                ...(tipo ? { tipo } : {}),
                                ...(activo ? { activo } : {}),
                            },
                        )}
                        disabled={descargando !== null}
                    >
                        {descargando === "catalogo" ? <Spinner size={16} /> : <Download size={16} />}
                        Descargar Excel
                    </button>
                </section>
            </div>
        </>
    );
}
