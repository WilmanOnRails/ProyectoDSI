import api from "./api";
import type { AuthenticatedUser, AuthSession } from "./authSession";

export async function login(
    email: string,
    password: string,
    remember: boolean,
): Promise<AuthSession> {
    const response = await api.post<AuthSession>("/auth/login", {
        email,
        password,
        remember,
    });
    return response.data;
}

export async function logout(refreshToken: string): Promise<void> {
    await api.post("/auth/logout", { refreshToken });
}

export async function register(
    nombre: string,
    email: string,
    password: string,
): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>("/auth/register", {
        nombre,
        email,
        password,
    });
    return response.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
    await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
    await api.post("/auth/reset-password", { token, password });
}

export async function updateMyProfile(data: {
    nombre: string;
    email: string;
    currentPassword: string;
    newPassword?: string;
}): Promise<AuthenticatedUser> {
    const response = await api.patch<AuthenticatedUser>("/auth/me", data);
    return response.data;
}
