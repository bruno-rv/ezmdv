import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createProjectRoutes } from './routes/projects.js';
import { createStateRoutes } from './routes/state.js';
import { setupWatcher, watchProject } from './watcher.js';
import { readState } from './state.js';
import type { FSWatcher } from 'chokidar';

export interface ServerOptions {
  staticDir?: string;
  port?: number;
  statePath?: string;
}

export interface ServerInstance {
  app: express.Express;
  server: http.Server;
  wss: WebSocketServer;
  watcher: FSWatcher;
}

export function createServer(options: ServerOptions = {}): ServerInstance {
  const { staticDir, statePath } = options;

  const app = express();

  // Middleware
  app.use(express.json());

  // CORS — restrict to localhost origins only
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // API routes
  app.use('/api/projects', createProjectRoutes(statePath));
  app.use('/api/state', createStateRoutes(statePath));

  // Serve static files if a directory is provided
  if (staticDir) {
    app.use(express.static(staticDir));
    // SPA fallback: serve index.html for non-API routes
    app.get('{*splat}', (_req, res) => {
      res.sendFile('index.html', { root: staticDir });
    });
  }

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server });

  // File watcher
  const watcher = setupWatcher(wss, () => readState(statePath));

  return { app, server, wss, watcher };
}

export { readState, updateState, writeState } from './state.js';
export type { AppState, Project, Tab } from './state.js';
export { watchProject } from './watcher.js';
