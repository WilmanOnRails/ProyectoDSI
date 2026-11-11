import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import {
    AUTH_SESSION_EVENT,
    clearAuthSession,
    getAuthSession,
    getAuthSessionExpiry,
} from "../services/authSession";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const [authenticated, setAuthenticated] = useState(
        () => getAuthSession() !== null,
    );

    useEffect(() => {
        const refreshSession = () => {
            setAuthenticated(getAuthSession() !== null);
        };

        window.addEventListener(AUTH_SESSION_EVENT, refreshSession);
        window.addEventListener("storage", refreshSession);

        let expirationTimer: number | undefined;
        if (authenticated) {
            const expiresAt = getAuthSessionExpiry();
            if (expiresAt === null) {
                clearAuthSession();
                setAuthenticated(false);
            } else {
                expirationTimer = window.setTimeout(() => {
                    clearAuthSession();
                    setAuthenticated(false);
                }, Math.max(0, expiresAt - Date.now()));
            }
        }

        return () => {
            window.removeEventListener(AUTH_SESSION_EVENT, refreshSession);
            window.removeEventListener("storage", refreshSession);
            if (expirationTimer !== undefined) {
                window.clearTimeout(expirationTimer);
            }
        };
    }, [authenticated]);

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
