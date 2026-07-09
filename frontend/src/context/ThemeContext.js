import React, { createContext, useContext, useEffect, useState } from 'react';

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

  const setAppearance = (a) => {
    localStorage.setItem('appearance', a);
    setAppearanceState(a);
  };

  const setReaderTheme = (t) => {
    localStorage.setItem('readerTheme', t);
    setReaderThemeState(t);
  };

  const setNavStyle = (s) => {
    localStorage.setItem('navStyle', s);
    setNavStyleState(s);
  };

  const setAccentOverride = (c) => {
    localStorage.setItem('accentOverride', c);
    setAccentOverrideState(c);
  };

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance, readerTheme, setReaderTheme, navStyle, setNavStyle, accentOverride, setAccentOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
