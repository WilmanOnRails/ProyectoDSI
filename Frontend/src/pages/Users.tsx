import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Check, LoaderCircle, RefreshCw, Users as UsersIcon } from "lucide-react";
import api, { apiGet } from "../services/api";
import { getAuthSession } from "../services/authSession";

type Rol = "administrador" | "presupuestista" | "solo_lectura";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    activo: boolean;
    ultimoAcceso: string | null;
};

const roles: { value: Rol; label: string }[] = [
    { value: "presupuestista", label: "Presupuestista" },
    { value: "solo_lectura", label: "Solo lectura" },
    { value: "administrador", label: "Administrador" },
];

function errorText(error: unknown): string {
    if (!isAxiosError(error)) return "Ocurrió un error inesperado.";
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
    if (!error.response) return "No se pudo conectar con el servidor.";
    return "No se pudo completar la operación.";
}

export default function Users() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [rolesSeleccionados, setRolesSeleccionados] = useState<Record<string, Rol>>({});
    const [cargando, setCargando] = useState(true);
    const [procesandoId, setProcesandoId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const isAdmin = getAuthSession()?.user.rol === "administrador";

    const cargarUsuarios = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const result = await apiGet<Usuario[]>("/users");
            setUsuarios(result);
            setRolesSeleccionados((current) => {
                const next = { ...current };
                for (const usuario of result) {
                    if (!next[usuario.id]) {
                        next[usuario.id] = "presupuestista";
                    }
                }
                return next;
            });
        } catch (loadError: unknown) {
            setError(errorText(loadError));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;

        let mounted = true;
        apiGet<Usuario[]>("/users")
            .then((result) => {
                if (!mounted) return;
                setUsuarios(result);
                setRolesSeleccionados((current) => {
                    const next = { ...current };
                    for (const usuario of result) {
                        if (!next[usuario.id]) {
                            next[usuario.id] = "presupuestista";
                        }
                    }
                    return next;
                });
            })
            .catch((loadError: unknown) => {
                if (mounted) setError(errorText(loadError));
            })
            .finally(() => {
                if (mounted) setCargando(false);
            });

        return () => {
            mounted = false;
        };
    }, [isAdmin]);

    async function aprobar(usuario: Usuario) {
        setProcesandoId(usuario.id);
        setError("");
        setMensaje("");
        try {
            await api.post(`/users/${usuario.id}/approve`, {
                rol: rolesSeleccionados[usuario.id] ?? "presupuestista",
            });
            setMensaje(`Se aprobó a ${usuario.nombre} y se envió el correo de aviso.`);
            await cargarUsuarios();
        } catch (approvalError: unknown) {
            setError(errorText(approvalError));
        } finally {
            setProcesandoId(null);
        }
    }

    if (!isAdmin) {
        return (
            <section className="panel">
                <h1>Acceso restringido</h1>
                <p>Solo un administrador puede gestionar usuarios.</p>
            </section>
        );
    }

    const pendientes = usuarios.filter((usuario) => !usuario.activo);

    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">ADMINISTRACIÓN</p>
                    <h1>Gestión de usuarios</h1>
                    <p className="muted">
                        Revisá las solicitudes, asigná un rol y habilitá el acceso.
                    </p>
                </div>
                <button className="secondary-button" onClick={() => void cargarUsuarios()} disabled={cargando}>
                    <RefreshCw size={17} /> Actualizar
                </button>
            </div>

            <section className="panel data-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Solicitudes pendientes ({pendientes.length})</h2>
                        <p>Al aprobar una solicitud, la persona recibirá un correo de aviso.</p>
                    </div>
                    <UsersIcon size={27} />
                </div>

                {error && <p className="import-error" role="alert">{error}</p>}
                {mensaje && <p className="import-success" role="status">{mensaje}</p>}

                {cargando ? (
                    <p className="muted" role="status">Cargando usuarios...</p>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Correo</th>
                                    <th>Estado</th>
                                    <th>Rol</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((usuario) => (
                                    <tr key={usuario.id}>
                                        <td><strong>{usuario.nombre}</strong></td>
                                        <td>{usuario.email}</td>
                                        <td>
                                            <span className={`status ${usuario.activo ? "status-en-proceso" : ""}`}>
                                                {usuario.activo ? "Activo" : "Pendiente"}
                                            </span>
                                        </td>
                                        <td>
                                            {usuario.activo ? (
                                                roles.find((role) => role.value === usuario.rol)?.label ?? usuario.rol
                                            ) : (
                                                <select
                                                    className="text-input"
                                                    aria-label={`Rol para ${usuario.nombre}`}
                                                    value={rolesSeleccionados[usuario.id] ?? "presupuestista"}
                                                    onChange={(event) => {
                                                        const selectedRole = roles.find(
                                                            (role) => role.value === event.target.value,
                                                        );
                                                        if (selectedRole) {
                                                            setRolesSeleccionados((current) => ({
                                                                ...current,
                                                                [usuario.id]: selectedRole.value,
                                                            }));
                                                        }
                                                    }}
                                                >
                                                    {roles.map((role) => (
                                                        <option key={role.value} value={role.value}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td>
                                            {!usuario.activo && (
                                                <button
                                                    className="primary-button"
                                                    onClick={() => void aprobar(usuario)}
                                                    disabled={procesandoId !== null}
                                                >
                                                    {procesandoId === usuario.id
                                                        ? <LoaderCircle className="spin" size={17} />
                                                        : <Check size={17} />}
                                                    Aprobar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!usuarios.length && (
                                    <tr>
                                        <td colSpan={5}>No hay usuarios registrados.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
