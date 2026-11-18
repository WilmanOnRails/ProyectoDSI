import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Check, RefreshCw, Users as UsersIcon } from "lucide-react";
import api, { apiGet } from "../services/api";
import { getAuthSession } from "../services/authSession";
import { useAlert } from "../components/Alerts";
import { Spinner } from "../components/Loading";

type Rol = "administrador" | "presupuestista" | "solo_lectura";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    activo: boolean;
    ultimoAcceso: string | null;
};

// El único administrador ya está definido: desde el panel solo se pueden
// asignar estos dos roles.
const roles: { value: Rol; label: string }[] = [
    { value: "presupuestista", label: "Presupuestista" },
    { value: "solo_lectura", label: "Solo lectura" },
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
    const { mostrarExito, mostrarError, mostrarAdvertencia } = useAlert();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [rolesSeleccionados, setRolesSeleccionados] = useState<Record<string, Rol>>({});
    const [cargando, setCargando] = useState(true);
    const [procesandoId, setProcesandoId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const session = getAuthSession();
    const isAdmin = session?.user.rol === "administrador";
    const miId = session?.user.id;

    const aplicarUsuarios = useCallback((result: Usuario[]) => {
        setUsuarios(result);
        setRolesSeleccionados(
            Object.fromEntries(result.map((usuario) => [usuario.id, usuario.rol])) as Record<string, Rol>,
        );
    }, []);

    const cargarUsuarios = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const result = await apiGet<Usuario[]>("/users");
            aplicarUsuarios(result);
        } catch (loadError: unknown) {
            setError(errorText(loadError));
        } finally {
            setCargando(false);
        }
    }, [aplicarUsuarios]);

    useEffect(() => {
        if (!isAdmin) return;

        let mounted = true;
        apiGet<Usuario[]>("/users")
            .then((result) => {
                if (mounted) aplicarUsuarios(result);
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
    }, [isAdmin, aplicarUsuarios]);

    async function aprobar(usuario: Usuario) {
        setProcesandoId(usuario.id);
        setError("");
        setMensaje("");
        try {
            await api.post(`/users/${usuario.id}/approve`, {
                rol: rolesSeleccionados[usuario.id] ?? "presupuestista",
            });
            const aviso = `Se activó la cuenta de ${usuario.nombre} y se envió el correo de aviso.`;
            setMensaje(aviso);
            mostrarExito(aviso);
            await cargarUsuarios();
        } catch (approvalError: unknown) {
            const aviso = errorText(approvalError);
            setError(aviso);
            mostrarError(aviso);
        } finally {
            setProcesandoId(null);
        }
    }

    async function cambiarRol(usuario: Usuario, rol: Rol) {
        if (usuario.id === miId) {
            const aviso = "No podés cambiar tu propio rol.";
            setError(aviso);
            mostrarAdvertencia(aviso);
            return;
        }

        const rolAnterior = rolesSeleccionados[usuario.id] ?? usuario.rol;
        setRolesSeleccionados((actual) => ({ ...actual, [usuario.id]: rol }));
        setProcesandoId(usuario.id);
        setError("");
        setMensaje("");
        try {
            await api.patch(`/users/${usuario.id}`, { rol });
            const etiqueta = roles.find((item) => item.value === rol)?.label ?? rol;
            const aviso = `Permisos de ${usuario.nombre} actualizados a ${etiqueta}.`;
            setMensaje(aviso);
            mostrarExito(aviso);
            await cargarUsuarios();
        } catch (changeError: unknown) {
            setRolesSeleccionados((actual) => ({ ...actual, [usuario.id]: rolAnterior }));
            const aviso = errorText(changeError);
            setError(aviso);
            mostrarError(aviso);
        } finally {
            setProcesandoId(null);
        }
    }

    async function desactivar(usuario: Usuario) {
        if (!window.confirm(
            `¿Desactivar la cuenta de ${usuario.nombre}? No podrá iniciar sesión hasta que la actives de nuevo.`,
        )) {
            return;
        }

        setProcesandoId(usuario.id);
        setError("");
        setMensaje("");
        try {
            await api.patch(`/users/${usuario.id}`, { activo: false });
            const aviso = `La cuenta de ${usuario.nombre} fue desactivada.`;
            setMensaje(aviso);
            mostrarExito(aviso);
            await cargarUsuarios();
        } catch (deactivateError: unknown) {
            const aviso = errorText(deactivateError);
            setError(aviso);
            mostrarError(aviso);
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

    const inactivos = usuarios.filter((usuario) => !usuario.activo);

    return (
        <>
            <div className="page-heading">
                <div>
                    <p className="eyebrow">ADMINISTRACIÓN</p>
                    <h1>Gestión de usuarios</h1>
                    <p className="muted">
                        Cambiá permisos, desactivá cuentas o reactivá las que estén inactivas.
                    </p>
                </div>
                <button className="secondary-button" onClick={() => void cargarUsuarios()} disabled={cargando}>
                    <RefreshCw size={17} /> Actualizar
                </button>
            </div>

            <section className="panel data-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Cuentas inactivas ({inactivos.length})</h2>
                        <p>Al aprobar una cuenta se reactiva el acceso y se envía un correo de aviso.</p>
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
                                    <th>Permisos (rol)</th>
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
                                                {usuario.activo ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td>
                                            {usuario.id === miId ? (
                                                <span className="muted">Administrador (fijo)</span>
                                            ) : (
                                                <select
                                                    className="text-input"
                                                    aria-label={`Permisos de ${usuario.nombre}`}
                                                    value={rolesSeleccionados[usuario.id] ?? usuario.rol}
                                                    onChange={(event) => void cambiarRol(
                                                        usuario,
                                                        event.target.value as Rol,
                                                    )}
                                                    disabled={procesandoId !== null}
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
                                            {usuario.activo ? (
                                                <button
                                                    className="secondary-button"
                                                    onClick={() => void desactivar(usuario)}
                                                    disabled={usuario.id === miId || procesandoId !== null}
                                                    title={usuario.id === miId ? "No podés desactivar tu propia cuenta" : "Desactivar cuenta"}
                                                >
                                                    {procesandoId === usuario.id
                                                        ? <Spinner size={16} />
                                                        : null}
                                                    Desactivar
                                                </button>
                                            ) : (
                                                <button
                                                    className="primary-button"
                                                    onClick={() => void aprobar(usuario)}
                                                    disabled={procesandoId !== null}
                                                >
                                                    {procesandoId === usuario.id
                                                        ? <Spinner size={17} />
                                                        : <Check size={17} />}
                                                    Activar
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
