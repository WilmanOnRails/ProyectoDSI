import axios, { type AxiosRequestConfig } from "axios";
import {
    clearAuthSession,
    getAuthToken,
    getRefreshToken,
    isRememberedSession,
    saveAuthSession,
    type AuthSession,
} from "./authSession";

const getCache = new Map<
  string,
  { expiresAt: number; request: Promise<unknown> }
>();
const getCacheTtlMs = 15_000;
let getCacheVersion = 0;
let cachedAuthToken: string | null | undefined;

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3000/api")
  .replace(/\/+$/, "")
  .replace(/\/api(?:\/v1)?$/, "");


const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Configuración interna para no renovar en bucle la propia llamada de refresh. */
type AuthRequestConfig = AxiosRequestConfig & {
  _skipAuthRefresh?: boolean;
  _retried?: boolean;
};

let renovando: Promise<boolean> | undefined;

/** Renueva la sesión una sola vez aunque fallen varias peticiones a la vez. */
export function refreshAuthSession(): Promise<boolean> {
  if (!renovando) {
    renovando = performRefresh().finally(() => {
      renovando = undefined;
    });
  }
  return renovando;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await api.post<AuthSession>(
      "/auth/refresh",
      { refreshToken },
      { _skipAuthRefresh: true } as AuthRequestConfig,
    );
    // Conservamos si la sesión estaba en localStorage (Recordarme) o no.
    saveAuthSession(response.data, isRememberedSession());
    return true;
  } catch {
    return false;
  }
}

api.interceptors.request.use((config) => {
  if (config.method && config.method.toLowerCase() !== "get") {
    getCacheVersion += 1;
    getCache.clear();
  }

  const token = getAuthToken();
  if (token !== cachedAuthToken) {
    cachedAuthToken = token;
    getCacheVersion += 1;
    getCache.clear();
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as AuthRequestConfig | undefined;
    const puedeRenovar =
        config &&
        !config._skipAuthRefresh &&
        !config._retried &&
        getRefreshToken() !== null;

    if (!puedeRenovar || !config) {
      clearAuthSession();
      return Promise.reject(error);
    }

    config._retried = true;
    const renovada = await refreshAuthSession();
    if (!renovada) {
      clearAuthSession();
      return Promise.reject(error);
    }

    // Se repite la petición original; el interceptor de request pone el token nuevo.
    return api(config);
  },
);

export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const token = getAuthToken();
  if (token !== cachedAuthToken) {
    cachedAuthToken = token;
    getCacheVersion += 1;
    getCache.clear();
  }

  const key = `${url}?${JSON.stringify(params ?? {})}`;
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.request as Promise<T>;
  }
  if (cached) getCache.delete(key);

  const version = getCacheVersion;
  const request = api.get<T>(url, { params }).then(
    ({ data }) => {
      if (version === getCacheVersion) {
        getCache.set(key, {
          expiresAt: Date.now() + getCacheTtlMs,
          request: Promise.resolve(data),
        });
      }
      return data;
    },
    (error: unknown) => {
      if (getCache.get(key)?.request === request) {
        getCache.delete(key);
      }
      throw error;
    },
  );
  getCache.set(key, { expiresAt: Number.POSITIVE_INFINITY, request });
  return request;
}

export default api;
