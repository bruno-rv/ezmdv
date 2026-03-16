import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditMode } from './useEditMode';

vi.mock('@/lib/api', () => ({
  saveFileContent: vi.fn(),
}));

import { saveFileContent } from '@/lib/api';

const mockedSave = vi.mocked(saveFileContent);

describe('useEditMode', () => {
  beforeEach(() => {
    mockedSave.mockResolvedValue(undefined);
  });

  it('enters edit mode and tracks dirty state', () => {
    const setPaneContent = vi.fn();
    const { result } = renderHook(() =>
      useEditMode({
        primaryTab: { projectId: 'p1', filePath: 'test.md' },
        primaryContent: 'original content',
        splitView: false,
        setPaneContent,
      }),
    );

    expect(result.current.editMode).toBe(false);
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.handleEnterEdit();
    });

    expect(result.current.editMode).toBe(true);
    expect(result.current.editContent).toBe('original content');
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setEditContent('modified');
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('does not enter edit mode in split view', () => {
    const setPaneContent = vi.fn();
    const { result } = renderHook(() =>
      useEditMode({
        primaryTab: { projectId: 'p1', filePath: 'test.md' },
        primaryContent: 'content',
        splitView: true,
        setPaneContent,
      }),
    );

    act(() => {
      result.current.handleEnterEdit();
    });

    expect(result.current.editMode).toBe(false);
  });

  it('exits edit mode when split view is enabled', () => {
    const setPaneContent = vi.fn();
    const { result, rerender } = renderHook(
      ({ splitView }) =>
        useEditMode({
          primaryTab: { projectId: 'p1', filePath: 'test.md' },
          primaryContent: 'content',
          splitView,
          setPaneContent,
        }),
      { initialProps: { splitView: false } },
    );

    act(() => {
      result.current.handleEnterEdit();
    });
    expect(result.current.editMode).toBe(true);

    rerender({ splitView: true });
    expect(result.current.editMode).toBe(false);
  });

  it('saves content and optionally exits', async () => {
    const setPaneContent = vi.fn();
    const { result } = renderHook(() =>
      useEditMode({
        primaryTab: { projectId: 'p1', filePath: 'test.md' },
        primaryContent: 'original',
        splitView: false,
        setPaneContent,
      }),
    );

    act(() => {
      result.current.handleEnterEdit();
    });
    act(() => {
      result.current.setEditContent('new content');
    });

    await act(async () => {
      await result.current.handleSave(true);
    });

    expect(mockedSave).toHaveBeenCalledWith('p1', 'test.md', 'new content');
    expect(setPaneContent).toHaveBeenCalledWith('primary', 'new content');
    expect(result.current.editMode).toBe(false);
  });
});
