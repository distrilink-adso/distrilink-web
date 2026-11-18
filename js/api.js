// =========================================================
// DistriLink — API client
// Every call to a microservice goes through here.
//
//   import { api } from "/js/api.js";
//   const products = await api.get("catalog", "/api/products");   // → the "data" of the response
//   const order    = await api.post("orders", "/api/orders", { items });
//
// The services answer with the ApiResponse wrapper (ADR-007):
//   { success, data, error: { code, message, details }, meta }
// This client returns only "data" on success and throws an ApiError on failure,
// so the pages never deal with the wrapper.
//
// While a service still answers in the old ProblemDetail format, it keeps working too.
// =========================================================
import { API } from "./config.js";
import { getToken, logout } from "./session.js";

/** Error thrown for every failed call. */
export class ApiError extends Error {
  constructor(status, code, message, details, meta) {
    super(message || `Error ${status}`);
    this.status = status;           // HTTP status (0 = no connection)
    this.code = code || null;       // error.code of ApiResponse, e.g. "VALIDATION_ERROR"
    this.details = details || {};   // { field: "message" } — use it with showFieldErrors(form, err.details)
    this.meta = meta || null;
  }

  /** Kept for pages written before ADR-007. */
  get errors() { return this.details; }
}

/** true when the body is an ApiResponse wrapper. */
function isWrapper(body) {
  return body !== null && typeof body === "object" && typeof body.success === "boolean";
}

async function request(service, path, { method = "GET", body, auth = true } = {}) {
  const base = API[service];
  if (!base) throw new Error(`Servicio desconocido: ${service}`);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(base + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR",
      `No se pudo conectar con ${service}. Revisa que el servicio esté encendido en ${base}.`);
  }

  // Expired or invalid token on a private call: close the session.
  if (response.status === 401 && auth && token) {
    logout();
    throw new ApiError(401, "UNAUTHORIZED", "Tu sesión terminó. Vuelve a iniciar sesión.");
  }

  if (response.status === 204) return null;

  const isJson = (response.headers.get("Content-Type") || "").includes("json");
  const payload = isJson ? await response.json() : await response.text();

  // ---- ApiResponse wrapper (ADR-007) ----
  if (isWrapper(payload)) {
    if (payload.success && response.ok) return payload.data;
    const e = payload.error || {};
    throw new ApiError(response.status, e.code, e.message, e.details, payload.meta);
  }

  // ---- Old format, while a service has not migrated yet ----
  if (response.ok) return payload;
  const p = isJson ? payload : {};
  throw new ApiError(response.status, p.code || p.title, p.detail || (typeof payload === "string" ? payload : ""), p.errors);
}

export const api = {
  get:    (service, path, opts)       => request(service, path, { ...opts, method: "GET" }),
  post:   (service, path, body, opts) => request(service, path, { ...opts, method: "POST", body }),
  put:    (service, path, body, opts) => request(service, path, { ...opts, method: "PUT", body }),
  patch:  (service, path, body, opts) => request(service, path, { ...opts, method: "PATCH", body }),
  delete: (service, path, opts)       => request(service, path, { ...opts, method: "DELETE" }),
};
