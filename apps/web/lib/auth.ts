"use client";

import { ApiError } from "@/lib/api-error";
import { apiGet, API_URL } from "@/lib/api";

export type AppRole = "ADMIN" | "TEACHER" | "STUDENT";

export type CurrentUser = {
  sub: string;
  email: string;
  fullName: string;
  role: AppRole;
  teacherId?: string;
  studentId?: string;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

const ACCESS_TOKEN_KEY = "study_crm_access_token";
const REFRESH_TOKEN_KEY = "study_crm_refresh_token";
const USER_KEY = "study_crm_user";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeGetItem(key: string): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(key);
}

function safeSetItem(key: string, value: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(key, value);
}

function safeRemoveItem(key: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(key);
}

let refreshPromise: Promise<string> | null = null;

export function clearSession() {
  safeRemoveItem(ACCESS_TOKEN_KEY);
  safeRemoveItem(REFRESH_TOKEN_KEY);
  safeRemoveItem(USER_KEY);
}

export async function login(email: string, password: string) {
  clearSession();

  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    let message = "Неверный логин или пароль";
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }
    } catch {
      // keep default message
    }
    throw new ApiError(response.status, response.statusText, message);
  }

  const tokens = (await response.json()) as LoginResponse;
  safeSetItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  safeSetItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

  const user = await getCurrentUser();
  if (user) {
    safeSetItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    throw new Error("Refresh failed");
  }

  const data = (await response.json()) as LoginResponse;
  safeSetItem(ACCESS_TOKEN_KEY, data.accessToken);
  safeSetItem(REFRESH_TOKEN_KEY, data.refreshToken);
  return data.accessToken;
}

export async function getCurrentUser() {
  const token = getAccessToken();
  if (!token) return null;
  const user = await apiGet<CurrentUser>("/auth/me", token);
  safeSetItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function getCachedUser(): CurrentUser | null {
  const raw = safeGetItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return safeGetItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return safeGetItem(REFRESH_TOKEN_KEY);
}

export function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    }).catch(() => undefined);
  }
  clearSession();
  if (isBrowser()) {
    window.location.href = "/login";
  }
}

export function homeForRole(role: AppRole) {
  if (role === "TEACHER") return "/teacher";
  if (role === "STUDENT") return "/student";
  return "/dashboard";
}

export function handleUnauthorizedRequest(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
