import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { refreshAuthSession } from "../services/api";
import {
    AUTH_SESSION_EVENT,
    clearAuthSession,
    getAuthSession,
    getAuthSessionExpiry,
    isAuthSessionExpired,
} from "../services/authSession";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const [authenticated, setAuthenticated] = useState(
        () => getAuthSession() !== null,
    );
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let activo = true;
        const sincronizar = () => setVersion((actual) => actual + 1);

        window.addEventListener(AUTH_SESSION_EVENT, sincronizar);
        window.addEventListener("storage", sincronizar);

        async function prepararSesion() {
            if (!getAuthSession()) {
                if (activo) setAuthenticated(false);
                return;
            }

            if (isAuthSessionExpired()) {
                const renovada = await refreshAuthSession();
                if (!renovada) clearAuthSession();
                if (activo) setAuthenticated(renovada);
                return;
            }

            if (activo) setAuthenticated(true);
        }
        void prepararSesion();

        // Cuando el access token esté por vencer, se renueva sin sacar al usuario.
        const expiresAt = getAuthSessionExpiry();
        let expirationTimer: number | undefined;
        if (authenticated && expiresAt !== null && expiresAt > Date.now()) {
            expirationTimer = window.setTimeout(async () => {
                const renovada = await refreshAuthSession();
                if (!renovada) clearAuthSession();
                if (activo) setAuthenticated(renovada);
            }, expiresAt - Date.now());
        }

        return () => {
            activo = false;
            window.removeEventListener(AUTH_SESSION_EVENT, sincronizar);
            window.removeEventListener("storage", sincronizar);
            if (expirationTimer !== undefined) {
                window.clearTimeout(expirationTimer);
            }
        };
    }, [authenticated, version]);

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
