export const THEME_STORAGE_KEY = 'crewmate_theme';

export type ThemeMode = 'dark' | 'light';

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
}

export function getInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function initializeTheme(): ThemeMode {
  const theme = getInitialTheme();
  applyTheme(theme);
  return theme;
}
