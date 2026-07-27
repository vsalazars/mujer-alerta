// src/lib/api.ts
import { extractInstitutionSlug } from "./routing";

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();

export const API_BASE = (
  configuredApiUrl ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
).replace(/\/$/, "");

export const PUBLIC_INSTITUCION_SLUG = (
  process.env.NEXT_PUBLIC_INSTITUCION_SLUG || ""
).trim();

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") || "";
}

function getPublicInstitutionSlug() {
  if (typeof window !== "undefined") {
    const fromPath = extractInstitutionSlug(window.location.pathname);
    if (fromPath) return fromPath;

    const params = new URLSearchParams(window.location.search);
    const fromQuery =
      params.get("institucion_slug")?.trim() ||
      params.get("slug")?.trim() ||
      params.get("institucion")?.trim() ||
      "";
    if (fromQuery) return fromQuery;
  }

  return PUBLIC_INSTITUCION_SLUG;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const institucionSlug = getPublicInstitutionSlug();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(institucionSlug ? { "X-Institucion-Slug": institucionSlug } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  // Por si algún endpoint regresa 204
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
