import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(
    () => localStorage.getItem('appearance') || 'system'
  );
  const [readerTheme, setReaderThemeState] = useState(
    () => localStorage.getItem('readerTheme') || ''
  );
  const [navStyle, setNavStyleState] = useState(
    () => localStorage.getItem('navStyle') || 'tabs'
  );
  // Empty string means "no override" — fall back to the borrowed book's cover colour.
  const [accentOverride, setAccentOverrideState] = useState(
    () => localStorage.getItem('accentOverride') || ''
  );

  useEffect(() => {
    const html = document.documentElement;

    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = appearance === 'system' ? (prefersDark ? 'dark' : 'light') : appearance;
      html.setAttribute('data-color-mode', resolved);
      if (readerTheme) {
        html.setAttribute('data-theme', readerTheme);
      } else {
        html.removeAttribute('data-theme');
      }
    };

    apply();

    if (appearance === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [appearance, readerTheme]);

  const setAppearance = useCallback((a) => {
    localStorage.setItem('appearance', a);
    setAppearanceState(a);
  }, []);

  const setReaderTheme = useCallback((t) => {
    localStorage.setItem('readerTheme', t);
    setReaderThemeState(t);
  }, []);

  const setNavStyle = useCallback((s) => {
    localStorage.setItem('navStyle', s);
    setNavStyleState(s);
  }, []);

  const setAccentOverride = useCallback((c) => {
    localStorage.setItem('accentOverride', c);
    setAccentOverrideState(c);
  }, []);

  const value = useMemo(
    () => ({ appearance, setAppearance, readerTheme, setReaderTheme, navStyle, setNavStyle, accentOverride, setAccentOverride }),
    [appearance, setAppearance, readerTheme, setReaderTheme, navStyle, setNavStyle, accentOverride, setAccentOverride]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
