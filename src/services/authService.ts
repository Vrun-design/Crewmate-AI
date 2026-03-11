import {api} from '../lib/api';
import type {AuthUser} from '../types';

const AUTH_FLAG_KEY = 'crewmate_auth';
const AUTH_TOKEN_KEY = 'crewmate_auth_token';
const AUTH_EMAIL_KEY = 'crewmate_user_email';

export const authStorage = {
  saveSession(token: string, email: string): void {
    localStorage.setItem(AUTH_FLAG_KEY, 'true');
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EMAIL_KEY, email);
  },
  clearSession(): void {
    localStorage.removeItem(AUTH_FLAG_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
  },
  isAuthenticated(): boolean {
    return localStorage.getItem(AUTH_FLAG_KEY) === 'true' && Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
  },
};

export const authService = {
  requestCode(email: string): Promise<{email: string; devCode?: string}> {
    return api.post('/api/auth/request-code', {email});
  },
  verifyCode(email: string, code: string): Promise<{token: string; user: AuthUser}> {
    return api.post('/api/auth/verify', {email, code});
  },
  me(): Promise<AuthUser> {
    return api.get('/api/auth/me');
  },
  logout(): Promise<void> {
    return api.post('/api/auth/logout');
  },
};
