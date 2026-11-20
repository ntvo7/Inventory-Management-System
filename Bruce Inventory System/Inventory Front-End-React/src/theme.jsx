import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'smm-theme';

// Light / dark mode. index.html sets the starting theme before React loads;
// this keeps it in sync and remembers the choice (when the browser allows storage).
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')} title="Light mode">
        <i className="fas fa-sun"></i>
        <span className="sr-only">Light mode</span>
      </button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} title="Dark mode">
        <i className="fas fa-moon"></i>
        <span className="sr-only">Dark mode</span>
      </button>
    </div>
  );
}
