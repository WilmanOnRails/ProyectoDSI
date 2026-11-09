import axios from "axios";
import { clearAuthSession, getAuthToken } from "./authSession";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3000/api")
    .replace(/\/+$/, "")
    .replace(/\/api(?:\/v1)?$/, "");

const api = axios.create({
    baseURL: `${apiBaseUrl}/api`,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            clearAuthSession();
        }
        return Promise.reject(error);
    },
);

export default api;
