import { useState, useEffect, useCallback } from 'react';
import { fetchState, updateState } from '@/lib/api';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check if the html element already has the dark class (SSR or prior state)
    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    // Default to system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // On mount, try to load theme from backend state
  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((state) => {
        if (!cancelled && state.theme) {
          setThemeState(state.theme);
          applyTheme(state.theme);
        }
      })
      .catch(() => {
        // If backend is unavailable, keep the default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      // Persist to backend (fire and forget)
      updateState({ theme: next }).catch(() => {
        // Silently fail if backend is down
      });
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
