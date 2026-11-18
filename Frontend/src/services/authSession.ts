export interface AuthenticatedUser {
    id: string;
    nombre: string;
    email: string;
    rol: string;
}

export interface AuthSession {
    access_token: string;
    /** Solo existe cuando el usuario tildó "Recordarme". */
    refresh_token?: string;
    user: AuthenticatedUser;
}

export const AUTH_SESSION_EVENT = "proyectodsi:session-changed";

const SESSION_KEY = "proyectodsi.auth";

function decodeTokenExpiration(token: string): number | null {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    try {
        const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        // atob exige que la longitud sea múltiplo de 4; sin el relleno, según
        // el largo del correo, la decodificación fallaba y borraba la sesión.
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
        const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
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

    // No borramos la sesión aunque el access token haya vencido: el refresh
    // token puede seguir vivo y nos permite renovar sin pedir la contraseña.
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
    // Sin "Recordarme" no se guarda el refresh token: cerrar la ventana debe
    // cerrar la sesión también en el servidor.
    const guardada: AuthSession = remember
        ? session
        : { access_token: session.access_token, user: session.user };
    storage.setItem(SESSION_KEY, JSON.stringify(guardada));
    notifySessionChange();
}

export function getRefreshToken(): string | null {
    return getAuthSession()?.refresh_token ?? null;
}

/** True si la sesión original se guardó en localStorage. */
export function isRememberedSession(): boolean {
    return localStorage.getItem(SESSION_KEY) !== null;
}

export function updateAuthSessionUser(user: AuthenticatedUser) {
    const session = getAuthSession();
    if (!session) return;

    const storage = localStorage.getItem(SESSION_KEY) !== null
        ? localStorage
        : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify({ ...session, user }));
    notifySessionChange();
}

export function getAuthSession(): AuthSession | null {
    return readSession(localStorage) ?? readSession(sessionStorage);
}

export function getUserInitials(nombre: string): string {
    const parts = nombre.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
        administrador: "Administrador",
        presupuestista: "Presupuestista",
        solo_lectura: "Solo lectura",
    };
    return labels[role] ?? role;
}

export function getAuthToken(): string | null {
    return getAuthSession()?.access_token ?? null;
}

export function canManagePlatformData(): boolean {
    const role = getAuthSession()?.user.rol;
    return role === "administrador" || role === "presupuestista";
}

export function getAuthSessionExpiry(): number | null {
    const token = getAuthToken();
    return token ? decodeTokenExpiration(token) : null;
}

export function isAuthSessionExpired(): boolean {
    const expiresAt = getAuthSessionExpiry();
    return expiresAt === null || expiresAt <= Date.now();
}

export function clearAuthSession() {
    removeStoredSessions();
    notifySessionChange();
}
