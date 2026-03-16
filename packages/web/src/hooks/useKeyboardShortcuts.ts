import { useEffect } from 'react';
import type { Tab } from '@/lib/api';
import type { Pane } from './useTabs';

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
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showShortcuts) return;

      if (e.key === 'Escape' && graphPreview) {
        setGraphPreview(null);
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape' && fullscreenPane) {
        e.preventDefault();
        setFullscreenPane(null);
        return;
      }

      if (mod && e.key === 's') {
        e.preventDefault();
        if (editMode && primaryTab) {
          handleSave();
        }
        return;
      }

      if (mod && e.key === 'e') {
        e.preventDefault();
        if (splitView) return;
        if (editMode) {
          handleExitEdit();
        } else if (primaryTab && primaryContent !== null) {
          handleEnterEdit();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.cm-editor')
      ) {
        return;
      }

      if (mod && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        autoScrollToggle();
        return;
      }

      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeTab) {
          if (
            editMode &&
            isDirty &&
            primaryTab &&
            activeTab.projectId === primaryTab.projectId &&
            activeTab.filePath === primaryTab.filePath
          ) {
            if (!window.confirm('You have unsaved changes. Close anyway?')) {
              return;
            }
          }
          setEditMode(false);
          closeTab(activeTab.projectId, activeTab.filePath);
        }
        return;
      }

      if (mod && e.key === ']') {
        e.preventDefault();
        switchToNextTab();
        return;
      }

      if (mod && e.key === '[') {
        e.preventDefault();
        switchToPrevTab();
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
    primaryContent,
    primaryTab,
    setEditMode,
    setFullscreenPane,
    setGraphPreview,
    showShortcuts,
    splitView,
    switchToNextTab,
    switchToPrevTab,
  ]);
}
