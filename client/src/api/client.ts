const BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "krushimitra.token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) — session lasts until reload */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  /** Stable, language-neutral error identifier from the server (translated by the UI). */
  code: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const UNAUTHORIZED_EVENT = "krushimitra:unauthorized";

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  /** Don't treat a 401 as an expired session (used by the login form). */
  skipAuthRedirect?: boolean;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // the browser sets the multipart boundary
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, { method: opts.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", "network");
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.skipAuthRedirect) {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code);
  }
  return data as T;
}
