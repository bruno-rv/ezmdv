import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  readyState = 1; // OPEN

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Auto-fire open after construction
    setTimeout(() => this.fireEvent('open'), 0);
  }

  addEventListener(event: string, handler: (...args: unknown[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: (...args: unknown[]) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.fireEvent('close');
  }

  fireEvent(event: string, data?: unknown) {
    const handlers = this.listeners[event] ?? [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  simulateMessage(data: object) {
    this.fireEvent('message', { data: JSON.stringify(data) });
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to WebSocket on mount', () => {
    renderHook(() => useWebSocket({}));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('/ws');
  });

  it('calls onFileChanged when receiving a file-changed message', async () => {
    const onFileChanged = vi.fn();
    renderHook(() => useWebSocket({ onFileChanged }));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: 'file-changed',
        projectId: 'p1',
        filePath: 'README.md',
      });
    });

    expect(onFileChanged).toHaveBeenCalledWith('p1', 'README.md');
  });

  it('ignores malformed messages', () => {
    const onFileChanged = vi.fn();
    renderHook(() => useWebSocket({ onFileChanged }));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.fireEvent('message', { data: 'not json' });
    });

    expect(onFileChanged).not.toHaveBeenCalled();
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket({}));
    const ws = MockWebSocket.instances[0];
    expect(ws.readyState).toBe(1);

    unmount();
    expect(ws.readyState).toBe(3);
  });
});
