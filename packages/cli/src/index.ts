#!/usr/bin/env node

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import open from 'open';
import path from 'node:path';
import {
  createServer,
  readState,
  updateState,
  watchProject,
} from '@ezmdv/server';
import type { Project } from '@ezmdv/server';
import { resolveTarget } from './resolve-target.js';

const program = new Command();

program
  .name('ezmdv')
  .description('Easy Markdown Viewer — view markdown files in the browser')
  .argument('<path>', 'file or directory path to view')
  .option('--port <number>', 'port to listen on (0 = random available port)', '0')
  .option('--no-open', 'skip opening the browser')
  .action(async (targetPath: string, options: { port: string; open: boolean }) => {
    // 1. Resolve the target path
    let target;
    try {
      target = resolveTarget(targetPath);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    // 2. Determine staticDir for the built frontend
    const staticDir = path.resolve(import.meta.dirname, '../../web/dist');

    // 3. Create the server
    const port = parseInt(options.port, 10);
    const { server, wss, watcher } = createServer({
      staticDir,
      port,
      statePath: undefined,
    });

    // 4. Start listening
    server.listen(port, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        console.error('Failed to get server address');
        process.exit(1);
      }
      const actualPort = addr.port;
      const url = `http://localhost:${actualPort}`;

      // 5. Register project in state
      const state = readState();
      const existing = state.projects.find((p) => p.path === target.path);

      if (existing) {
        // Update lastOpened
        const updatedProjects = state.projects.map((p) =>
          p.path === target.path
            ? { ...p, lastOpened: new Date().toISOString() }
            : p,
        );
        updateState({ projects: updatedProjects });
      } else {
        // Add new project
        const newProject: Project = {
          id: uuidv4(),
          name: target.name,
          source: 'cli',
          path: target.path,
          lastOpened: new Date().toISOString(),
        };
        updateState({ projects: [...state.projects, newProject] });
      }

      // 6. Start watching the project's files
      watchProject(watcher, target.path);

      console.log(`ezmdv serving ${target.name} at ${url}`);

      // 7. Open the browser (unless --no-open)
      if (options.open) {
        open(url).catch(() => {
          // Silently ignore if browser open fails
        });
      }
    });

    // 8. Graceful shutdown
    function shutdown() {
      console.log('\nShutting down...');
      watcher.close();
      wss.close();
      server.close(() => {
        process.exit(0);
      });
      // Force exit after 3 seconds if close hangs
      setTimeout(() => process.exit(0), 3000);
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parse();
