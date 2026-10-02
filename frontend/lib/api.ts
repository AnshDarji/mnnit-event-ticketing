const TOKEN_KEY = "mnnit-pilot-token";
export function token() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY);
}
export function saveToken(value: string | null) {
  if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const bearer = token();
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw new ApiError("We couldn't reach the campus services. Please try again.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail)
      ? data.detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join(" ") || "Input"}: ${item.msg || "Invalid value"}`).join(". ")
      : response.status >= 500
      ? "The campus services are starting up or temporarily unavailable. Please try again in a moment."
      : response.status === 401 ? "Your session has expired. Please sign in again."
      : "Please check your information and try again.";
    if (response.status === 401) saveToken(null);
    throw new ApiError(message, response.status);
  }
  return data as T;
}
export function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
