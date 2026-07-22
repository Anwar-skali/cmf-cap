import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const THEME_KEY = 'cmf_theme';

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored !== null) {
    return stored === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeStore() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeStore must be used within a ThemeProvider');
  }
  return context;
}
