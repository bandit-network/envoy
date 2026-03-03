import type { ApiResponse } from "@envoy/types";

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(
      json.error?.code ?? "UNKNOWN",
      json.error?.message ?? "An unexpected error occurred",
      res.status
    );
  }

  return json.data as T;
}

export async function apiGet<T>(path: string, authFetch: AuthFetch): Promise<T> {
  const res = await authFetch(path);
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  authFetch: AuthFetch
): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  authFetch: AuthFetch
): Promise<T> {
  const res = await authFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string, authFetch: AuthFetch): Promise<T> {
  const res = await authFetch(path, { method: "DELETE" });
  return handleResponse<T>(res);
}
