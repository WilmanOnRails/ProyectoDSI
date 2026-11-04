import api from "./api";
import type { AuthSession } from "./authSession";

export async function login(email: string, password: string): Promise<AuthSession> {
    const response = await api.post<AuthSession>("/auth/login", { email, password });
    return response.data;
}
