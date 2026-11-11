import { useState, type FormEvent } from "react";
import { ArrowLeft, Building2, KeyRound, Mail } from "lucide-react";
import { isAxiosError } from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { requestPasswordReset, resetPassword } from "../services/auth";
import "./Login.css";

function getErrorMessage(error: unknown): string {
    if (isAxiosError<{ message?: string | string[] }>(error)) {
        const message = error.response?.data?.message;
        if (typeof message === "string") return message;
        if (Array.isArray(message)) return message.join(" ");
        if (!error.response) {
            return "No se pudo conectar con el servidor. Verifica tu conexión.";
        }
    }

    return "Ocurrió un error inesperado. Intenta de nuevo.";
}

export default function PasswordRecovery() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;

        setErrorMessage("");

        if (token && password !== passwordConfirmation) {
            setErrorMessage("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);
        try {
            if (token) {
                await resetPassword(token, password);
            } else {
                await requestPasswordReset(email);
            }
            setCompleted(true);
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    const isResetForm = Boolean(token);

    return (
        <main className="login-page">
            <section className="login-brand-panel" aria-label="ProyectoDSI">
                <div className="login-brand">
                    <span className="login-brand-mark">
                        <Building2 size={24} strokeWidth={1.8} />
                    </span>
                    <span className="login-brand-name">
                        <strong>ProyectoDSI</strong>
                        <small>GESTIÓN DE OBRAS</small>
                    </span>
                </div>

                <div className="login-brand-copy recovery-brand-copy">
                    <p className="login-eyebrow">
                        <span className="login-eyebrow-line" />
                        ACCESO SEGURO
                    </p>
                    <h1>
                        Recuperá el acceso
                        <br />
                        a tu <span>espacio de trabajo.</span>
                    </h1>
                    <p className="login-brand-description">
                        {isResetForm
                            ? "Elegí una contraseña nueva para volver a gestionar tus proyectos."
                            : "Te enviaremos un enlace seguro para que puedas crear una contraseña nueva."}
                    </p>
                </div>
                <div className="login-orbit login-orbit-one" />
                <div className="login-orbit login-orbit-two" />
            </section>

            <section className="login-form-panel">
                <div className="login-form-wrap">
                    {!completed ? (
                        <>
                            <div className="login-form-heading">
                                <span className="login-form-kicker">
                                    {isResetForm ? "NUEVA CONTRASEÑA" : "RECUPERACIÓN DE CUENTA"}
                                </span>
                                <h2>
                                    {isResetForm ? "Crear contraseña nueva" : "¿Olvidaste tu contraseña?"}
                                </h2>
                                <p>
                                    {isResetForm
                                        ? "Usá al menos 8 caracteres para proteger tu cuenta."
                                        : "Ingresá tu correo y te enviaremos instrucciones para recuperarla."}
                                </p>
                            </div>

                            <form
                                className="login-form"
                                onSubmit={handleSubmit}
                                aria-busy={loading}
                            >
                                {isResetForm ? (
                                    <>
                                        <label className="login-label" htmlFor="recovery-password">
                                            Nueva contraseña
                                        </label>
                                        <div className="login-input-wrap">
                                            <KeyRound className="login-input-icon" size={19} aria-hidden="true" />
                                            <input
                                                id="recovery-password"
                                                name="password"
                                                type="password"
                                                value={password}
                                                onChange={(event) => setPassword(event.target.value)}
                                                disabled={loading}
                                                required
                                                minLength={8}
                                                autoComplete="new-password"
                                                placeholder="Mínimo 8 caracteres"
                                            />
                                        </div>

                                        <label className="login-label recovery-second-label" htmlFor="recovery-password-confirmation">
                                            Confirmar contraseña
                                        </label>
                                        <div className="login-input-wrap">
                                            <KeyRound className="login-input-icon" size={19} aria-hidden="true" />
                                            <input
                                                id="recovery-password-confirmation"
                                                name="passwordConfirmation"
                                                type="password"
                                                value={passwordConfirmation}
                                                onChange={(event) => setPasswordConfirmation(event.target.value)}
                                                disabled={loading}
                                                required
                                                minLength={8}
                                                autoComplete="new-password"
                                                placeholder="Repetí la contraseña"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <label className="login-label" htmlFor="recovery-email">
                                            Correo electrónico
                                        </label>
                                        <div className="login-input-wrap">
                                            <Mail className="login-input-icon" size={19} aria-hidden="true" />
                                            <input
                                                id="recovery-email"
                                                name="email"
                                                type="email"
                                                value={email}
                                                onChange={(event) => setEmail(event.target.value)}
                                                disabled={loading}
                                                required
                                                autoComplete="email"
                                                placeholder="nombre@empresa.com"
                                            />
                                        </div>
                                    </>
                                )}

                                {errorMessage && (
                                    <p className="login-error" role="alert">
                                        {errorMessage}
                                    </p>
                                )}

                                <button className="login-submit" type="submit" disabled={loading}>
                                    {loading
                                        ? "Procesando..."
                                        : isResetForm
                                          ? "Guardar contraseña nueva"
                                          : "Enviar instrucciones"}
                                </button>
                            </form>

                            <Link className="recovery-back-link" to="/login">
                                <ArrowLeft size={16} aria-hidden="true" />
                                Volver a iniciar sesión
                            </Link>
                        </>
                    ) : (
                        <div className="recovery-complete" role="status">
                            <span className="recovery-complete-icon" aria-hidden="true">
                                {isResetForm ? <KeyRound size={23} /> : <Mail size={23} />}
                            </span>
                            <span className="login-form-kicker">
                                {isResetForm ? "CONTRASEÑA ACTUALIZADA" : "REVISA TU CORREO"}
                            </span>
                            <h2>
                                {isResetForm ? "Ya podés iniciar sesión" : "Solicitud recibida"}
                            </h2>
                            <p>
                                {isResetForm
                                    ? "Tu contraseña fue actualizada correctamente."
                                    : "Si existe una cuenta activa con ese correo, recibirás un enlace para crear una contraseña nueva. El enlace vence en una hora."}
                            </p>
                            <Link className="login-submit recovery-login-link" to="/login">
                                Ir a iniciar sesión
                            </Link>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
