const TOKEN_KEY = "at_token";
const USER_KEY = "at_user";
export const BASE = "/inspecciones";

function withBase(path) {
  if (path.startsWith(BASE)) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function loadUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function photoUrl(id) {
  const token = getToken() || "";
  return withBase(`/api/photos/${id}?access_token=${encodeURIComponent(token)}`);
}

export function machinePhotoUrl(id, kind) {
  const token = getToken() || "";
  return withBase(`/api/machines/${id}/photos/${kind}?access_token=${encodeURIComponent(token)}`);
}

export function manualUrl(modelId) {
  const token = getToken() || "";
  return withBase(`/api/models/${modelId}/manual?access_token=${encodeURIComponent(token)}`);
}

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(withBase(path), {
    method,
    headers,
    body: payload,
    credentials: "include",
  });
  if (response.status === 204) return null;
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json().catch(() => ({})) : null;
  if (!response.ok) {
    const detail = data?.detail;
    let message = "No se pudo completar la acción.";
    if (typeof detail === "string") message = detail;
    else if (detail && typeof detail.message === "string") message = detail.message;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    if (response.status === 401 && !path.startsWith("/api/auth/login")) {
      clearSession();
      if (!window.location.pathname.startsWith(`${BASE}/login`)) window.location.assign(`${BASE}/login`);
    }
    throw error;
  }
  return data;
}

export async function download(path, filename) {
  const response = await fetch(withBase(path), {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    credentials: "include",
  });
  if (!response.ok) {
    const isJson = (response.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await response.json().catch(() => ({})) : null;
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : "No se pudo descargar el archivo.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
