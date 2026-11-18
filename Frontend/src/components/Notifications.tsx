import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getAuthSession } from "../services/authSession";
import { Spinner } from "./Loading";

type CambioPrecio = {
    id: string;
    descripcion: string;
    precio: string;
    fecha: string;
};

type Pendiente = {
    id: string;
    nombre: string;
};

const DIAS_RECIENTES = 7;
const money = (valor: string) =>
    `C$ ${Number(valor || 0).toLocaleString("es-NI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function Notifications() {
    const navigate = useNavigate();
    const [abierto, setAbierto] = useState(false);
    const [pendientes, setPendientes] = useState<Pendiente[]>([]);
    const [cambios, setCambios] = useState<CambioPrecio[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const contenedor = useRef<HTMLDivElement>(null);
    const esAdmin = getAuthSession()?.user.rol === "administrador";

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [resumen, cuentasPendientes] = await Promise.all([
                apiGet<{ ultimasActualizaciones: CambioPrecio[] }>("/dashboard/resumen"),
                esAdmin
                    ? apiGet<Pendiente[]>("/users/pending")
                    : Promise.resolve([] as Pendiente[]),
            ]);

            const limite = Date.now() - DIAS_RECIENTES * 24 * 60 * 60 * 1000;
            setCambios(
                resumen.ultimasActualizaciones.filter(
                    (cambio) => new Date(cambio.fecha).getTime() >= limite,
                ),
            );
            setPendientes(cuentasPendientes);
        } catch {
            setError("No se pudieron cargar las notificaciones.");
        } finally {
            setCargando(false);
        }
    }, [esAdmin]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    useEffect(() => {
        if (!abierto) return;

        const cerrarAlClickearAfuera = (event: MouseEvent) => {
            if (!contenedor.current?.contains(event.target as Node)) {
                setAbierto(false);
            }
        };
        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setAbierto(false);
        };

        document.addEventListener("mousedown", cerrarAlClickearAfuera);
        document.addEventListener("keydown", cerrarConEscape);
        return () => {
            document.removeEventListener("mousedown", cerrarAlClickearAfuera);
            document.removeEventListener("keydown", cerrarConEscape);
        };
    }, [abierto]);

    const total = pendientes.length + cambios.length;

    function irA(ruta: string) {
        setAbierto(false);
        navigate(ruta);
    }

    return (
        <div className="notificaciones" ref={contenedor}>
            <button
                className="icon-button notificaciones-boton"
                type="button"
                aria-label={total ? `Notificaciones (${total})` : "Notificaciones"}
                aria-expanded={abierto}
                onClick={() => {
                    setAbierto((actual) => !actual);
                    if (!abierto) void cargar();
                }}
            >
                <Bell size={20} />
                {total > 0 && (
                    <span className="notificaciones-contador">
                        {total > 9 ? "9+" : total}
                    </span>
                )}
            </button>

            {abierto && (
                <div className="notificaciones-panel" role="dialog" aria-label="Notificaciones">
                    <div className="notificaciones-cabecera">
                        <strong>Notificaciones</strong>
                        <div className="notificaciones-acciones">
                            <button
                                className="icon-button"
                                type="button"
                                title="Actualizar"
                                aria-label="Actualizar notificaciones"
                                onClick={() => void cargar()}
                                disabled={cargando}
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                className="icon-button"
                                type="button"
                                title="Cerrar"
                                aria-label="Cerrar notificaciones"
                                onClick={() => setAbierto(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {cargando && (
                        <p className="notificaciones-estado">
                            <Spinner size={16} /> Cargando...
                        </p>
                    )}
                    {!cargando && error && (
                        <p className="notificaciones-estado">{error}</p>
                    )}
                    {!cargando && !error && total === 0 && (
                        <p className="notificaciones-estado">No hay notificaciones nuevas.</p>
                    )}

                    {!cargando && pendientes.length > 0 && (
                        <section className="notificaciones-seccion">
                            <h4>Cuentas pendientes ({pendientes.length})</h4>
                            {pendientes.slice(0, 3).map((pendiente) => (
                                <button
                                    key={pendiente.id}
                                    className="notificaciones-item"
                                    type="button"
                                    onClick={() => irA("/usuarios")}
                                >
                                    <span>
                                        <strong>{pendiente.nombre}</strong> espera aprobación.
                                    </span>
                                    <ChevronRight size={15} />
                                </button>
                            ))}
                            {pendientes.length > 3 && (
                                <small className="muted">
                                    y {pendientes.length - 3} más
                                </small>
                            )}
                        </section>
                    )}

                    {!cargando && cambios.length > 0 && (
                        <section className="notificaciones-seccion">
                            <h4>Cambios de precio</h4>
                            {cambios.map((cambio) => (
                                <button
                                    key={cambio.id}
                                    className="notificaciones-item"
                                    type="button"
                                    onClick={() => irA("/recursos")}
                                >
                                    <span>
                                        <strong>{cambio.descripcion}</strong> ahora {money(cambio.precio)}
                                        <small className="muted">
                                            {" "}
                                            {new Date(cambio.fecha).toLocaleDateString("es-NI", {
                                                day: "2-digit",
                                                month: "short",
                                            })}
                                        </small>
                                    </span>
                                    <ChevronRight size={15} />
                                </button>
                            ))}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
