import { firebaseAuthService } from '../services/firebaseAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const AUTH_TOKEN_KEY = 'crewmate_auth_token';
const AUTH_FLAG_KEY = 'crewmate_auth';
const AUTH_EMAIL_KEY = 'crewmate_user_email';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message ?? `API request failed: ${status}`);
    this.status = status;
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const firebaseToken = firebaseAuthService.isConfigured()
    ? await firebaseAuthService.getIdToken()
    : '';
  const token = firebaseToken || (typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_FLAG_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_EMAIL_KEY);
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader()),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401) {
      const hadToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
      if (hadToken) {
        clearAuthSession();
        window.dispatchEvent(new CustomEvent('crewmate:auth-expired'));
      }
    }

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
