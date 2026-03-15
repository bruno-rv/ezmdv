import { useState, useEffect, useCallback } from 'react';
import { fetchState, updateState, type Tab } from '@/lib/api';

export type Pane = 'primary' | 'secondary';

interface WorkspaceLayout {
  primaryTab: Tab | null;
  secondaryTab: Tab | null;
  focusedPane: Pane;
  splitView: boolean;
  fullscreenPane: Pane | null;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  primaryTab: null,
  secondaryTab: null,
  focusedPane: 'primary',
  splitView: false,
  fullscreenPane: null,
};

function isSameTab(a: Tab | null, b: Tab | null): boolean {
  return Boolean(
    a &&
      b &&
      a.projectId === b.projectId &&
      a.filePath === b.filePath,
  );
}

function findTab(tabs: Tab[], target: Tab | null): Tab | null {
  if (!target) return null;
  return (
    tabs.find(
      (tab) =>
        tab.projectId === target.projectId && tab.filePath === target.filePath,
    ) ?? null
  );
}

function findOriginalIndex(tabs: Tab[], target: Tab | null): number {
  if (!target) return -1;
  return tabs.findIndex(
    (tab) =>
      tab.projectId === target.projectId && tab.filePath === target.filePath,
  );
}

function pickReplacementTab(
  tabs: Tab[],
  startIndex: number,
  exclude: Tab | null,
): Tab | null {
  if (tabs.length === 0) return null;

  const safeStart = Math.max(0, Math.min(startIndex, tabs.length - 1));
  const visited = new Set<number>();

  for (let distance = 0; distance < tabs.length; distance++) {
    const candidates =
      distance === 0
        ? [safeStart]
        : [safeStart - distance, safeStart + distance];

    for (const index of candidates) {
      if (index < 0 || index >= tabs.length || visited.has(index)) continue;
      visited.add(index);

      const candidate = tabs[index];
      if (!isSameTab(candidate, exclude)) {
        return candidate;
      }
    }
  }

  return null;
}

function pickReplacementAfterRemoval(
  nextTabs: Tab[],
  prevTabs: Tab[],
  removedTarget: Tab | null,
  exclude: Tab | null,
): Tab | null {
  if (!removedTarget || nextTabs.length === 0) return null;
  const removedIndex = findOriginalIndex(prevTabs, removedTarget);
  const startIndex =
    removedIndex === -1 ? 0 : Math.min(removedIndex, nextTabs.length - 1);
  return pickReplacementTab(nextTabs, startIndex, exclude);
}

function reconcileLayout(
  nextTabs: Tab[],
  prevTabs: Tab[],
  prevLayout: WorkspaceLayout,
): WorkspaceLayout {
  let primaryTab = findTab(nextTabs, prevLayout.primaryTab);
  if (!primaryTab) {
    primaryTab = pickReplacementAfterRemoval(
      nextTabs,
      prevTabs,
      prevLayout.primaryTab,
      null,
    );
  }
  if (!primaryTab && nextTabs.length > 0) {
    primaryTab = nextTabs[0];
  }

  let secondaryTab = prevLayout.splitView
    ? findTab(nextTabs, prevLayout.secondaryTab)
    : null;

  if (prevLayout.splitView && !secondaryTab) {
    secondaryTab = pickReplacementAfterRemoval(
      nextTabs,
      prevTabs,
      prevLayout.secondaryTab,
      primaryTab,
    );
  }

  if (primaryTab && secondaryTab && isSameTab(primaryTab, secondaryTab)) {
    const fallback = pickReplacementTab(
      nextTabs,
      Math.min(
        Math.max(findOriginalIndex(prevTabs, prevLayout.secondaryTab), 0),
        Math.max(nextTabs.length - 1, 0),
      ),
      primaryTab,
    );
    secondaryTab = fallback;
  }

  const splitView = Boolean(prevLayout.splitView && primaryTab && secondaryTab);
  const focusedPane =
    splitView && prevLayout.focusedPane === 'secondary'
      ? 'secondary'
      : 'primary';

  let fullscreenPane = prevLayout.fullscreenPane;
  if (fullscreenPane === 'primary' && !primaryTab) {
    fullscreenPane = null;
  }
  if (fullscreenPane === 'secondary' && !secondaryTab) {
    fullscreenPane = null;
  }

  return {
    primaryTab,
    secondaryTab: splitView ? secondaryTab : null,
    focusedPane,
    splitView,
    fullscreenPane,
  };
}

function assignTabToFocusedPane(
  layout: WorkspaceLayout,
  tab: Tab,
): WorkspaceLayout {
  if (!layout.splitView) {
    return {
      ...layout,
      primaryTab: tab,
      focusedPane: 'primary',
    };
  }

  if (layout.focusedPane === 'primary') {
    if (isSameTab(layout.secondaryTab, tab)) {
      return {
        ...layout,
        focusedPane: 'secondary',
      };
    }
    return {
      ...layout,
      primaryTab: tab,
      focusedPane: 'primary',
    };
  }

  if (isSameTab(layout.primaryTab, tab)) {
    return {
      ...layout,
      focusedPane: 'primary',
    };
  }

  return {
    ...layout,
    secondaryTab: tab,
    focusedPane: 'secondary',
  };
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    let cancelled = false;

    fetchState()
      .then((state) => {
        if (cancelled) return;
        const openTabs = state.openTabs ?? [];
        setTabs(openTabs);
        setLayout({
          ...DEFAULT_LAYOUT,
          primaryTab: openTabs[0] ?? null,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const syncTabs = useCallback((nextTabs: Tab[]) => {
    updateState({ openTabs: nextTabs }).catch(() => {});
  }, []);

  const openTab = useCallback(
    (projectId: string, filePath: string) => {
      const requestedTab: Tab = { projectId, filePath };

      setTabs((prevTabs) => {
        const existing =
          prevTabs.find(
            (tab) =>
              tab.projectId === projectId && tab.filePath === filePath,
          ) ?? requestedTab;

        const nextTabs = prevTabs.some(
          (tab) =>
            tab.projectId === projectId && tab.filePath === filePath,
        )
          ? prevTabs
          : [...prevTabs, requestedTab];

        setLayout((prevLayout) => assignTabToFocusedPane(prevLayout, existing));

        if (nextTabs !== prevTabs) {
          syncTabs(nextTabs);
        }

        return nextTabs;
      });
    },
    [syncTabs],
  );

  const closeTab = useCallback(
    (projectId: string, filePath: string) => {
      setTabs((prevTabs) => {
        const nextTabs = prevTabs.filter(
          (tab) =>
            tab.projectId !== projectId || tab.filePath !== filePath,
        );

        if (nextTabs.length === prevTabs.length) {
          return prevTabs;
        }

        setLayout((prevLayout) => reconcileLayout(nextTabs, prevTabs, prevLayout));
        syncTabs(nextTabs);
        return nextTabs;
      });
    },
    [syncTabs],
  );

  const closeProjectTabs = useCallback(
    (projectId: string) => {
      setTabs((prevTabs) => {
        const nextTabs = prevTabs.filter((tab) => tab.projectId !== projectId);

        if (nextTabs.length === prevTabs.length) {
          return prevTabs;
        }

        setLayout((prevLayout) => reconcileLayout(nextTabs, prevTabs, prevLayout));
        syncTabs(nextTabs);
        return nextTabs;
      });
    },
    [syncTabs],
  );

  const switchTab = useCallback(
    (projectId: string, filePath: string) => {
      setTabs((prevTabs) => {
        const existing = prevTabs.find(
          (tab) =>
            tab.projectId === projectId && tab.filePath === filePath,
        );
        if (!existing) {
          return prevTabs;
        }

        setLayout((prevLayout) => assignTabToFocusedPane(prevLayout, existing));
        return prevTabs;
      });
    },
    [],
  );

  const switchInDirection = useCallback((direction: 1 | -1) => {
    setTabs((prevTabs) => {
      if (prevTabs.length <= 1) return prevTabs;

      setLayout((prevLayout) => {
        const currentTab =
          prevLayout.splitView && prevLayout.focusedPane === 'secondary'
            ? prevLayout.secondaryTab
            : prevLayout.primaryTab;

        const currentIndex = currentTab
          ? prevTabs.findIndex((tab) => isSameTab(tab, currentTab))
          : -1;

        const baseIndex =
          currentIndex === -1
            ? direction === 1
              ? -1
              : 0
            : currentIndex;
        const nextIndex =
          (baseIndex + direction + prevTabs.length) % prevTabs.length;

        return assignTabToFocusedPane(prevLayout, prevTabs[nextIndex]);
      });

      return prevTabs;
    });
  }, []);

  const switchToNextTab = useCallback(() => {
    switchInDirection(1);
  }, [switchInDirection]);

  const switchToPrevTab = useCallback(() => {
    switchInDirection(-1);
  }, [switchInDirection]);

  const focusPane = useCallback((pane: Pane) => {
    setLayout((prevLayout) => {
      if (pane === 'secondary' && !prevLayout.splitView) {
        return prevLayout;
      }
      return {
        ...prevLayout,
        focusedPane: pane,
      };
    });
  }, []);

  const enterSplitView = useCallback(() => {
    setLayout((prevLayout) => {
      if (!prevLayout.primaryTab) return prevLayout;
      return {
        ...prevLayout,
        splitView: true,
        secondaryTab: null,
        focusedPane: 'secondary',
        fullscreenPane: null,
      };
    });
  }, []);

  const exitSplitView = useCallback(() => {
    setLayout((prevLayout) => {
      const retainedTab =
        prevLayout.focusedPane === 'secondary' && prevLayout.secondaryTab
          ? prevLayout.secondaryTab
          : prevLayout.primaryTab;

      return {
        primaryTab: retainedTab,
        secondaryTab: null,
        focusedPane: 'primary',
        splitView: false,
        fullscreenPane: null,
      };
    });
  }, []);

  const setFullscreenPane = useCallback((pane: Pane | null) => {
    setLayout((prevLayout) => {
      if (pane === 'secondary' && !prevLayout.splitView) {
        return prevLayout;
      }

      return {
        ...prevLayout,
        fullscreenPane: pane,
      };
    });
  }, []);

  const activeTab =
    layout.splitView && layout.focusedPane === 'secondary'
      ? layout.secondaryTab ?? layout.primaryTab
      : layout.primaryTab;

  return {
    tabs,
    activeTab,
    primaryTab: layout.primaryTab,
    secondaryTab: layout.secondaryTab,
    focusedPane: layout.focusedPane,
    splitView: layout.splitView,
    fullscreenPane: layout.fullscreenPane,
    openTab,
    closeTab,
    closeProjectTabs,
    switchTab,
    switchToNextTab,
    switchToPrevTab,
    focusPane,
    enterSplitView,
    exitSplitView,
    setFullscreenPane,
  };
}
