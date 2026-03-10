const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const AUTH_TOKEN_KEY = 'crewmate_auth_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message ?? `API request failed: ${status}`);
    this.status = status;
  }
}

function getAuthHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
}

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function buildAuthenticatedEventSourceUrl(path: string): string {
  const url = new URL(buildApiUrl(path), typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const token = getAuthToken();

  if (token) {
    url.searchParams.set('authToken', token);
  }

  return url.toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = `API request failed: ${response.status}`;

    try {
      if (contentType.includes('application/json')) {
        const payload = await response.json() as { message?: string };
        if (payload.message) {
          message = payload.message;
        }
      } else {
        const text = await response.text();
        if (text.trim()) {
          message = text.trim();
        }
      }
    } catch {
      // Keep the default message when the body cannot be parsed.
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
