import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { readState, type Project } from './state.js';

export function isPathWithinRoot(fullPath: string, rootPath: string): boolean {
  const resolved = path.resolve(fullPath);
  const root = path.resolve(rootPath);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export interface ProjectRequest extends Request {
  project: Project;
}

export function projectLookup(statePath?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const state = readState(statePath);
    const project = state.projects.find((p) => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    (req as ProjectRequest).project = project;
    next();
  };
}
