export interface AuthenticatedUser {
    id: string;
    nombre: string;
    email: string;
    rol: string;
}

export interface AuthSession {
    access_token: string;
    user: AuthenticatedUser;
}

export const AUTH_SESSION_EVENT = "proyectodsi:session-changed";

const SESSION_KEY = "proyectodsi.auth";

function decodeTokenExpiration(token: string): number | null {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    try {
        const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(window.atob(base64)) as { exp?: unknown };
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

function isAuthSession(value: unknown): value is AuthSession {
    if (typeof value !== "object" || value === null) return false;

    const candidate = value as Partial<AuthSession>;
    return (
        typeof candidate.access_token === "string" &&
        typeof candidate.user === "object" &&
        candidate.user !== null &&
        typeof candidate.user.id === "string" &&
        typeof candidate.user.nombre === "string" &&
        typeof candidate.user.email === "string" &&
        typeof candidate.user.rol === "string"
    );
}

function readSession(storage: Storage): AuthSession | null {
    const serialized = storage.getItem(SESSION_KEY);
    if (!serialized) return null;

    let value: unknown;
    try {
        value = JSON.parse(serialized);
    } catch {
        storage.removeItem(SESSION_KEY);
        return null;
    }

    if (!isAuthSession(value)) {
        storage.removeItem(SESSION_KEY);
        return null;
    }

    const expiresAt = decodeTokenExpiration(value.access_token);
    if (expiresAt === null || expiresAt <= Date.now()) {
        storage.removeItem(SESSION_KEY);
        return null;
    }

    return value;
}

function notifySessionChange() {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

function removeStoredSessions() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

export function saveAuthSession(session: AuthSession, remember: boolean) {
    removeStoredSessions();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    notifySessionChange();
}

export function getAuthSession(): AuthSession | null {
    return readSession(localStorage) ?? readSession(sessionStorage);
}

export function getAuthToken(): string | null {
    return getAuthSession()?.access_token ?? null;
}

export function getAuthSessionExpiry(): number | null {
    const token = getAuthToken();
    return token ? decodeTokenExpiration(token) : null;
}

export function clearAuthSession() {
    removeStoredSessions();
    notifySessionChange();
}
