import { useEffect, useRef, useCallback } from 'react';

export interface FileChangedMessage {
  type: 'file-changed';
  projectId: string;
  filePath: string;
}

type WebSocketMessage = FileChangedMessage;

interface UseWebSocketOptions {
  onFileChanged?: (projectId: string, filePath: string) => void;
}

/**
 * Hook that connects to the server's WebSocket endpoint for live reload.
 * Auto-reconnects with exponential backoff (max 5 retries).
 */
export function useWebSocket({ onFileChanged }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;
  const onFileChangedRef = useRef(onFileChanged);
  onFileChangedRef.current = onFileChanged;

  const connect = useCallback(() => {
    // Determine the WebSocket URL based on current origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        retriesRef.current = 0;
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          if (data.type === 'file-changed' && onFileChangedRef.current) {
            onFileChangedRef.current(data.projectId, data.filePath);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.addEventListener('close', () => {
        wsRef.current = null;
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
          retriesRef.current++;
          setTimeout(connect, delay);
        }
      });

      ws.addEventListener('error', () => {
        // The close event will fire after error, which handles reconnect
        ws.close();
      });
    } catch {
      // WebSocket constructor can throw if URL is invalid
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      const ws = wsRef.current;
      if (ws) {
        // Prevent reconnect on intentional close
        retriesRef.current = maxRetries;
        ws.close();
      }
    };
  }, [connect]);
}
