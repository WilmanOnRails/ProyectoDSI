import api from "./api";
import type { AuthSession } from "./authSession";

export async function login(email: string, password: string): Promise<AuthSession> {
    const response = await api.post<AuthSession>("/auth/login", { email, password });
    return response.data;
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
