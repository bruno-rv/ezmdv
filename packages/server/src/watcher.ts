import { watch, type FSWatcher } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import type { AppState } from './state.js';

export function setupWatcher(
  wss: WebSocketServer,
  getState: () => AppState,
): FSWatcher {
  const watcher = watch([], {
    ignoreInitial: true,
    persistent: true,
  });

  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function broadcast(data: object): void {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  function handleFileEvent(eventPath: string): void {
    const key = eventPath;
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    debounceTimers.set(
      key,
      setTimeout(() => {
        debounceTimers.delete(key);

        const state = getState();
        // Find which project this file belongs to
        for (const project of state.projects) {
          if (eventPath.startsWith(project.path)) {
            const relativePath = eventPath
              .slice(project.path.length)
              .replace(/^\//, '');
            broadcast({
              type: 'file-changed',
              projectId: project.id,
              filePath: relativePath,
            });
            break;
          }
        }
      }, 100),
    );
  }

  watcher.on('change', handleFileEvent);
  watcher.on('add', handleFileEvent);
  watcher.on('unlink', handleFileEvent);

  // Watch existing project directories
  const state = getState();
  for (const project of state.projects) {
    watcher.add(project.path);
  }

  return watcher;
}

export function watchProject(watcher: FSWatcher, projectPath: string): void {
  watcher.add(projectPath);
}
