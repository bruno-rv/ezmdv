import { useState, useCallback, useRef, useEffect } from 'react';
import { saveFileContent } from '@/lib/api';
import type { Tab } from '@/lib/api';

interface UseEditModeOptions {
  primaryTab: Tab | null;
  primaryContent: string | null;
  splitView: boolean;
  setPaneContent: (pane: 'primary', content: string) => void;
}

export function useEditMode({
  primaryTab,
  primaryContent,
  splitView,
  setPaneContent,
}: UseEditModeOptions) {
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editModeRef = useRef(false);

  const [livePreview, setLivePreview] = useState(false);

  const isDirty = editMode && editContent !== primaryContent;

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    if (splitView && editMode && !livePreview) {
      setEditMode(false);
    }
  }, [editMode, splitView, livePreview]);

  const prevPrimaryTabRef = useRef<Tab | null>(null);
  useEffect(() => {
    if (
      prevPrimaryTabRef.current &&
      primaryTab &&
      (prevPrimaryTabRef.current.projectId !== primaryTab.projectId ||
        prevPrimaryTabRef.current.filePath !== primaryTab.filePath)
    ) {
      setEditMode(false);
    }
    prevPrimaryTabRef.current = primaryTab;
  }, [primaryTab]);

  const handleEnterEdit = useCallback(() => {
    if ((splitView && !livePreview) || primaryContent === null) return;
    setEditContent(primaryContent);
    setEditMode(true);
  }, [primaryContent, splitView, livePreview]);

  const handleExitEdit = useCallback(async () => {
    if (isDirty && primaryTab && !saving) {
      setSaving(true);
      try {
        await saveFileContent(primaryTab.projectId, primaryTab.filePath, editContent);
        setPaneContent('primary', editContent);
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setSaving(false);
      }
    }
    setEditMode(false);
    setLivePreview(false);
  }, [isDirty, primaryTab, saving, editContent, setPaneContent]);

  const handleSave = useCallback(
    async (exitAfter = false) => {
      if (!primaryTab || saving) return;
      setSaving(true);
      try {
        await saveFileContent(primaryTab.projectId, primaryTab.filePath, editContent);
        setPaneContent('primary', editContent);
        if (exitAfter) setEditMode(false);
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setSaving(false);
      }
    },
    [editContent, primaryTab, saving, setPaneContent],
  );

  return {
    editMode,
    editContent,
    saving,
    isDirty,
    livePreview,
    editModeRef,
    setEditMode,
    setEditContent,
    setLivePreview,
    handleEnterEdit,
    handleExitEdit,
    handleSave,
  };
}
