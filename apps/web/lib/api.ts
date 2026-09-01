import { ApiError } from "./api-error";
import { getAccessToken, handleUnauthorizedRequest } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function isPublicAuthPath(path: string) {
  return path === "/auth/login" || path === "/auth/refresh" || path === "/auth/logout";
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    retryOnUnauthorized?: boolean;
  } = {}
): Promise<T> {
  const { method = "GET", body, token: providedToken, retryOnUnauthorized = true } = options;
  const token = providedToken ?? getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  if (response.status === 401 && retryOnUnauthorized && !isPublicAuthPath(path) && token) {
    try {
      const newToken = await handleUnauthorizedRequest();
      return request<T>(path, { method, body, token: newToken, retryOnUnauthorized: false });
    } catch {
      throw new ApiError(401, "Unauthorized", "Сессия истекла. Войдите снова.");
    }
  }

  let errorMessage = `API request failed: ${response.status}`;
  try {
    const errorData = await response.json();
    if (typeof errorData === "object" && errorData !== null && "message" in errorData) {
      const data = errorData as { message: string | string[] };
      errorMessage = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
  } catch {
    // ignore
  }

  throw new ApiError(response.status, response.statusText, errorMessage);
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  return request<T>(path, { method: "GET", token });
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: "POST", body, token });
}

export async function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: "PATCH", body, token });
}

export async function apiPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: "PUT", body, token });
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  return request<T>(path, { method: "DELETE", token });
}

export { API_URL };
