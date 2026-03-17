import { useEffect } from 'react';
import type { Tab } from '@/lib/api';
import type { Pane } from './useTabs';
import { SHORTCUT_DEFS, matchesEvent, getEffectiveBindings } from '@/lib/shortcuts';

interface UseKeyboardShortcutsOptions {
  activeTab: Tab | null;
  primaryTab: Tab | null;
  primaryContent: string | null;
  editMode: boolean;
  isDirty: boolean;
  splitView: boolean;
  fullscreenPane: Pane | null;
  showShortcuts: boolean;
  graphPreview: unknown | null;
  keyboardShortcuts?: Record<string, string>;
  handleSave: (exitAfter?: boolean) => void;
  handleEnterEdit: () => void;
  handleExitEdit: () => void;
  setEditMode: (v: boolean) => void;
  closeTab: (projectId: string, filePath: string) => void;
  switchToNextTab: () => void;
  switchToPrevTab: () => void;
  setFullscreenPane: (pane: Pane | null) => void;
  setGraphPreview: (v: null) => void;
  autoScrollToggle: () => void;
  refreshPaneContent: (pane: 'primary' | 'secondary') => void;
  toggleToc: () => void;
}

export function useKeyboardShortcuts({
  activeTab,
  primaryTab,
  primaryContent,
  editMode,
  isDirty,
  splitView,
  fullscreenPane,
  showShortcuts,
  graphPreview,
  keyboardShortcuts = {},
  handleSave,
  handleEnterEdit,
  handleExitEdit,
  setEditMode,
  closeTab,
  switchToNextTab,
  switchToPrevTab,
  setFullscreenPane,
  setGraphPreview,
  autoScrollToggle,
  refreshPaneContent,
  toggleToc,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const bindings = getEffectiveBindings(keyboardShortcuts);

    function handleKeyDown(e: KeyboardEvent) {
      if (showShortcuts) return;

      // Non-customizable: Escape closes graph preview or exits fullscreen
      if (e.key === 'Escape' && graphPreview) {
        setGraphPreview(null);
        return;
      }
      if (e.key === 'Escape' && fullscreenPane) {
        e.preventDefault();
        setFullscreenPane(null);
        return;
      }

      // Find matching customizable shortcut
      let matchedId: string | null = null;
      for (const def of SHORTCUT_DEFS) {
        if (!def.customizable) continue;
        const binding = bindings.get(def.id) ?? def.defaultBinding;
        if (matchesEvent(binding, e)) {
          matchedId = def.id;
          break;
        }
      }

      if (!matchedId) return;

      // save and toggleEdit are allowed even in input/editor context
      if (matchedId === 'save') {
        e.preventDefault();
        if (editMode && primaryTab) handleSave();
        return;
      }

      if (matchedId === 'toggleEdit') {
        e.preventDefault();
        if (splitView) return;
        if (editMode) handleExitEdit();
        else if (primaryTab && primaryContent !== null) handleEnterEdit();
        return;
      }

      // Remaining shortcuts are suppressed when focus is in an input/editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.cm-editor')
      ) {
        return;
      }

      switch (matchedId) {
        case 'autoScroll':
          e.preventDefault();
          autoScrollToggle();
          break;
        case 'refresh':
          e.preventDefault();
          if (!editMode) refreshPaneContent('primary');
          break;
        case 'toggleToc':
          e.preventDefault();
          if (!editMode && !splitView) toggleToc();
          break;
        case 'closeTab':
          e.preventDefault();
          if (activeTab) {
            if (
              editMode &&
              isDirty &&
              primaryTab &&
              activeTab.projectId === primaryTab.projectId &&
              activeTab.filePath === primaryTab.filePath
            ) {
              if (!window.confirm('You have unsaved changes. Close anyway?')) return;
            }
            setEditMode(false);
            closeTab(activeTab.projectId, activeTab.filePath);
          }
          break;
        case 'nextTab':
          e.preventDefault();
          switchToNextTab();
          break;
        case 'prevTab':
          e.preventDefault();
          switchToPrevTab();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    autoScrollToggle,
    closeTab,
    editMode,
    fullscreenPane,
    graphPreview,
    handleEnterEdit,
    handleExitEdit,
    handleSave,
    isDirty,
    keyboardShortcuts,
    primaryContent,
    primaryTab,
    refreshPaneContent,
    setEditMode,
    setFullscreenPane,
    setGraphPreview,
    showShortcuts,
    splitView,
    switchToNextTab,
    switchToPrevTab,
    toggleToc,
  ]);
}
