import axios from "axios";
import { clearAuthSession, getAuthToken } from "./authSession";

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
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      getCacheVersion += 1;
      getCache.clear();
      clearAuthSession();
    }
    return Promise.reject(error);
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
