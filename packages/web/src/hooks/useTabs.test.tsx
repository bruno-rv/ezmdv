import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabs } from './useTabs';

vi.mock('@/lib/api', () => ({
  fetchState: vi.fn(),
  updateState: vi.fn(),
}));

import { fetchState, updateState } from '@/lib/api';

const mockedFetchState = vi.mocked(fetchState);
const mockedUpdateState = vi.mocked(updateState);

describe('useTabs', () => {
  beforeEach(() => {
    mockedFetchState.mockResolvedValue({
      theme: 'light',
      projects: [],
      openTabs: [
        { projectId: 'p1', filePath: 'left.md' },
        { projectId: 'p1', filePath: 'right.md' },
      ],
      checkboxStates: {},
    });
    mockedUpdateState.mockResolvedValue({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    });
  });

  it('swaps the primary and secondary panes in split view', async () => {
    const { result } = renderHook(() => useTabs());

    await waitFor(() => {
      expect(result.current.primaryTab?.filePath).toBe('left.md');
    });

    act(() => {
      result.current.enterSplitView();
    });

    act(() => {
      result.current.openTab('p1', 'right.md');
    });

    expect(result.current.primaryTab?.filePath).toBe('left.md');
    expect(result.current.secondaryTab?.filePath).toBe('right.md');

    act(() => {
      result.current.swapPanes();
    });

    expect(result.current.primaryTab?.filePath).toBe('right.md');
    expect(result.current.secondaryTab?.filePath).toBe('left.md');
  });
});
