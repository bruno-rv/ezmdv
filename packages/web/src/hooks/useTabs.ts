import { useState, useEffect, useCallback } from 'react';
import { fetchState, updateState, type Tab } from '@/lib/api';

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  // Load tabs from backend on mount
  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((state) => {
        if (!cancelled && state.openTabs && state.openTabs.length > 0) {
          setTabs(state.openTabs);
          setActiveTab(state.openTabs[0]);
        }
      })
      .catch(() => {
        // Backend unavailable, start with empty tabs
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncTabs = useCallback((newTabs: Tab[]) => {
    updateState({ openTabs: newTabs }).catch(() => {
      // Silently fail
    });
  }, []);

  const openTab = useCallback(
    (projectId: string, filePath: string) => {
      setTabs((prev) => {
        const existing = prev.find(
          (t) => t.projectId === projectId && t.filePath === filePath,
        );
        if (existing) {
          setActiveTab(existing);
          return prev;
        }
        const newTab: Tab = { projectId, filePath };
        const newTabs = [...prev, newTab];
        setActiveTab(newTab);
        syncTabs(newTabs);
        return newTabs;
      });
    },
    [syncTabs],
  );

  const closeTab = useCallback(
    (projectId: string, filePath: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex(
          (t) => t.projectId === projectId && t.filePath === filePath,
        );
        if (idx === -1) return prev;

        const newTabs = prev.filter((_, i) => i !== idx);

        // If closing the active tab, switch to the nearest tab
        setActiveTab((currentActive) => {
          if (
            currentActive &&
            currentActive.projectId === projectId &&
            currentActive.filePath === filePath
          ) {
            if (newTabs.length === 0) return null;
            // Prefer the tab at the same index or the one before
            const newIdx = Math.min(idx, newTabs.length - 1);
            return newTabs[newIdx];
          }
          return currentActive;
        });

        syncTabs(newTabs);
        return newTabs;
      });
    },
    [syncTabs],
  );

  const switchTab = useCallback(
    (projectId: string, filePath: string) => {
      setTabs((prev) => {
        const tab = prev.find(
          (t) => t.projectId === projectId && t.filePath === filePath,
        );
        if (tab) {
          setActiveTab(tab);
        }
        return prev;
      });
    },
    [],
  );

  return {
    tabs,
    activeTab,
    openTab,
    closeTab,
    switchTab,
  };
}
