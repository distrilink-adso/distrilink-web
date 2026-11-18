// =========================================================
// DistriLink — Login and registration (access-control-service, ADR-007)
//
//   import { login, register } from "/js/auth.js";
//   const user = await login("tienda@correo.com", "Clave1234");   // saves the session
//   window.location.href = homeFor(user);
// =========================================================
import { api } from "./api.js";
import { saveSession } from "./session.js";
import { ROUTES } from "./config.js";

/**
 * POST /api/auth/login → saves the JWT and returns the user read from it.
 * Throws ApiError: 401 INVALID_CREDENTIALS, 403 ACCOUNT_DISABLED, 400 VALIDATION_ERROR.
 */
export async function login(email, password) {
  const data = await api.post("auth", "/api/auth/login", { email, password }, { auth: false });
  return saveSession(data.accessToken);
}

/**
 * POST /api/users → creates the account (it does not log in).
 * role: "CUSTOMER" or "DISTRIBUTOR". Throws ApiError 400 VALIDATION_ERROR or 409 EMAIL_ALREADY_REGISTERED.
 */
export function register({ name, email, password, role }) {
  return api.post("auth", "/api/users", { name, email, password, role }, { auth: false });
}

/** Home page of the user's role. */
export function homeFor(user) {
  return ROUTES.home[user.role] || ROUTES.login;
}
