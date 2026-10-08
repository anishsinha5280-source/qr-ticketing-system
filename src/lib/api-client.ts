"use client";

import type { ApiResponse } from "@/lib/types";

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Fetch wrapper that understands the `{ ok, data } / { ok, error }` envelope. */
export async function apiFetch<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Network error — is the server running?");
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(response.status, "BAD_RESPONSE", "Unexpected server response");
  }

  if (payload && payload.ok) return payload.data;

  const error = payload && !payload.ok ? payload.error : undefined;
  throw new ApiClientError(
    response.status,
    error?.code ?? "ERROR",
    error?.message ?? `Request failed (${response.status})`,
    (error?.details as Record<string, string>) ?? undefined,
  );
}
