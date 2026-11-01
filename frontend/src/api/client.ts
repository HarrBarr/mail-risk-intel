import type { z } from "zod";

import {
  acceptedSchema,
  emailDetailSchema,
  emailListSchema,
  errorBodySchema,
  graphSchema,
  healthSchema,
  type Level,
  type Status,
} from "./schemas";

export type ApiErrorKind = "network" | "http" | "contract";

/** One error type for the whole UI: components only need `message`, `status` and `kind`. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  /** 4xx errors carry a message meant for the user (validation, not found, conflict). */
  get isClientError(): boolean {
    return this.status !== null && this.status >= 400 && this.status < 500;
  }
}

const BASE = "/api";

async function readDetail(res: Response): Promise<string> {
  try {
    const parsed = errorBodySchema.safeParse(await res.json());
    if (parsed.success) {
      const { detail } = parsed.data;
      return typeof detail === "string" ? detail : detail.map((d) => d.msg).join("; ");
    }
  } catch {
    // non-JSON body (e.g. an nginx 502 page) — fall through
  }
  if (res.status >= 500) return "The server ran into a problem. Please try again.";
  return res.statusText || `Request failed (${res.status})`;
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network", "Can't reach the server. Check that the API is running.");
  }
  if (!res.ok) {
    throw new ApiError("http", await readDetail(res), res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("contract", "The server sent a response that isn't JSON.", res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`Unexpected response shape from ${path}`, parsed.error.issues);
    throw new ApiError("contract", "The server sent data in an unexpected format.", res.status);
  }
  return parsed.data;
}

export interface EmailFilters {
  risk?: Level;
  status?: Status;
  q?: string;
  limit?: number;
  offset?: number;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: (signal?: AbortSignal) => request("/health", healthSchema, { signal }),

  listEmails: (filters: EmailFilters = {}, signal?: AbortSignal) =>
    request(`/emails${query({ ...filters })}`, emailListSchema, { signal }),

  getEmail: (id: string, signal?: AbortSignal) =>
    request(`/emails/${encodeURIComponent(id)}`, emailDetailSchema, { signal }),

  createFromText: (rawText: string) =>
    request("/emails", acceptedSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
    }),

  createFromFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header: the browser sets the multipart boundary.
    return request("/emails", acceptedSchema, { method: "POST", body: form });
  },

  reprocess: (id: string) =>
    request(`/emails/${encodeURIComponent(id)}/reprocess`, acceptedSchema, { method: "POST" }),

  graph: (minRisk?: Level, signal?: AbortSignal) =>
    request(`/graph${query({ min_risk: minRisk })}`, graphSchema, { signal }),
};
