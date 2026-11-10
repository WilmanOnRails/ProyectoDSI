import { useState, type FormEvent } from "react";
import { Building2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/auth";
import { saveAuthSession } from "../services/authSession";
import "./Login.css";

function ConstructionIllustration() {
    return (
        <svg
            className="login-illustration"
            viewBox="0 0 760 470"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <linearGradient id="login-building" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#28496f" />
                    <stop offset="1" stopColor="#193250" />
                </linearGradient>
                <linearGradient id="login-crane" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#f5ba66" />
                    <stop offset="1" stopColor="#e99a46" />
                </linearGradient>
            </defs>

            <path d="M0 416H760" stroke="#7890aa" strokeOpacity=".38" />
            <path d="M47 416 120 361h91l65 55" stroke="#7890aa" strokeOpacity=".24" />
            <path d="m485 416 72-57h90l69 57" stroke="#7890aa" strokeOpacity=".24" />

            <path d="M57 416V186l46-32 48 32v230H57Z" fill="url(#login-building)" stroke="#66809c" strokeOpacity=".62" />
            <path d="M79 210h20v28H79zm43 0h20v28h-20zm-43 54h20v28H79zm43 0h20v28h-20zm-43 54h20v28H79zm43 0h20v28h-20z" fill="#9db0c5" fillOpacity=".42" />
            <path d="M165 416V114l59-42 61 42v302H165Z" fill="url(#login-building)" stroke="#7890aa" strokeOpacity=".7" />
            <path d="M188 139h24v34h-24zm51 0h24v34h-24zm-51 64h24v34h-24zm51 0h24v34h-24zm-51 64h24v34h-24zm51 0h24v34h-24zm-51 64h24v34h-24zm51 0h24v34h-24z" fill="#b8c5d3" fillOpacity=".48" />
            <path d="M281 416V220l38-29 40 29v196h-78Z" fill="#213d5d" stroke="#7890aa" strokeOpacity=".56" />
            <path d="M300 245h16v26h-16zm32 0h16v26h-16zm-32 51h16v26h-16zm32 0h16v26h-16z" fill="#9db0c5" fillOpacity=".38" />

            <path d="M416 416V158l65-47 67 47v258H416Z" fill="url(#login-building)" stroke="#7890aa" strokeOpacity=".72" />
            <path d="M440 184h26v37h-26zm57 0h26v37h-26zm-57 68h26v37h-26zm57 0h26v37h-26zm-57 68h26v37h-26zm57 0h26v37h-26z" fill="#b8c5d3" fillOpacity=".47" />
            <path d="M551 416V239l43-32 43 32v177h-86Z" fill="#203b5a" stroke="#7890aa" strokeOpacity=".6" />
            <path d="M570 261h18v27h-18zm32 0h18v27h-18zm-32 50h18v27h-18zm32 0h18v27h-18z" fill="#9db0c5" fillOpacity=".4" />

            <path d="M357 416V70" stroke="url(#login-crane)" strokeWidth="8" />
            <path d="M350 73 319 91h76l-32-18Z" fill="#f3b35f" />
            <path d="M353 86H94" stroke="url(#login-crane)" strokeWidth="7" strokeLinecap="round" />
            <path d="m100 86 31-20m-1 20 31-20m-1 20 31-20m-1 20 31-20m-1 20 31-20m-1 20 31-20" stroke="#f3b35f" strokeOpacity=".48" strokeWidth="1.5" />
            <path d="M357 86h236" stroke="url(#login-crane)" strokeWidth="7" strokeLinecap="round" />
            <path d="m581 86-25-18m1 18-25-18m1 18-25-18m1 18-25-18m1 18-25-18" stroke="#f3b35f" strokeOpacity=".48" strokeWidth="1.5" />
            <path d="M572 88v83c0 11 9 20 20 20h9" stroke="#f3b35f" strokeWidth="2" />
            <path d="M600 187v11l10 10 10-10v-11" stroke="#f3b35f" strokeWidth="3" strokeLinejoin="round" />
            <path d="M357 72V52h-25" stroke="#f3b35f" strokeWidth="3" strokeLinecap="round" />
            <path d="m319 416 38-41 38 41m-55 0 17-22 18 22" stroke="#f3b35f" strokeOpacity=".76" strokeWidth="2" />

            <circle cx="92" cy="111" r="3" fill="#f3b35f" />
            <circle cx="629" cy="145" r="3" fill="#f3b35f" />
            <circle cx="387" cy="125" r="2" fill="#a9bdd1" />
        </svg>
    );
}

export default function Login() {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;

        setLoading(true);
        setErrorMessage("");

        try {
            const session = await login(email, password);
            saveAuthSession(session, remember);
            navigate("/", { replace: true });
        } catch (error: unknown) {
            if (isAxiosError(error)) {
                if (error.response?.status === 401) {
                    setErrorMessage("El correo o la contraseña no son correctos.");
                } else if (error.response && error.response.status >= 500) {
                    setErrorMessage("El servidor tuvo un problema. Intenta de nuevo más tarde.");
                } else if (!error.response) {
                    setErrorMessage("No se pudo conectar con el servidor. Verifica tu conexión.");
                } else {
                    setErrorMessage("No fue posible iniciar sesión. Revisa los datos e inténtalo de nuevo.");
                }
            } else {
                setErrorMessage("Ocurrió un error inesperado. Intenta de nuevo.");
            }
        } finally {
            setLoading(false);
        }
    }

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

                <div className="login-brand-copy">
                    <p className="login-eyebrow">
                        <span className="login-eyebrow-line" />
                        PLANIFICÁ CON PRECISIÓN
                    </p>
                    <h1>
                        Cada gran obra
                        <br />
                        comienza con
                        <br />
                        <span>un buen plan.</span>
                    </h1>
                    <p className="login-brand-description">
                        Presupuestos claros, proyectos bajo control y decisiones
                        mejor informadas en cada etapa de tu obra.
                    </p>
                </div>

                <ConstructionIllustration />

                <div className="login-brand-footer">
                    <span>PLANIFICACIÓN</span>
                    <i />
                    <span>PRESUPUESTOS</span>
                    <i />
                    <span>OBRAS</span>
                </div>
                <div className="login-orbit login-orbit-one" />
                <div className="login-orbit login-orbit-two" />
            </section>

            <section className="login-form-panel">
                <div className="login-form-wrap">
                    <div className="login-form-heading">
                        <span className="login-form-kicker">BIENVENIDO/A</span>
                        <h2>Iniciar sesión</h2>
                        <p>Ingresá a tu espacio de trabajo.</p>
                    </div>

                    <form
                        className="login-form"
                        onSubmit={handleSubmit}
                        aria-busy={loading}
                    >
                        <label className="login-label" htmlFor="login-email">
                            Correo electrónico
                        </label>
                        <div className="login-input-wrap">
                            <Mail className="login-input-icon" size={19} aria-hidden="true" />
                            <input
                                id="login-email"
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

                        <div className="login-password-label-row">
                            <label className="login-label" htmlFor="login-password">
                                Contraseña
                            </label>
                            <Link
                                className="login-forgot-link"
                                to="/recuperar-contrasena"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                        <div className="login-input-wrap">
                            <LockKeyhole className="login-input-icon" size={19} aria-hidden="true" />
                            <input
                                id="login-password"
                                name="password"
                                type={passwordVisible ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={loading}
                                required
                                autoComplete="current-password"
                                placeholder="Ingresá tu contraseña"
                            />
                            <button
                                className="login-password-toggle"
                                type="button"
                                disabled={loading}
                                aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                                aria-pressed={passwordVisible}
                                onClick={() => setPasswordVisible((visible) => !visible)}
                            >
                                {passwordVisible ? (
                                    <EyeOff size={19} aria-hidden="true" />
                                ) : (
                                    <Eye size={19} aria-hidden="true" />
                                )}
                            </button>
                        </div>

                        <label className="login-remember">
                            <input
                                type="checkbox"
                                name="remember"
                                checked={remember}
                                onChange={(event) => setRemember(event.target.checked)}
                                disabled={loading}
                            />
                            <span className="login-checkbox" aria-hidden="true" />
                            <span>Recordarme</span>
                        </label>

                        {errorMessage && (
                            <p className="login-error" role="alert">
                                {errorMessage}
                            </p>
                        )}

                        <button className="login-submit" type="submit" disabled={loading}>
                            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
