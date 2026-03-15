import { Router, type Request, type Response } from 'express';
import { readState, updateState, type AppState } from '../state.js';

export function createStateRoutes(statePath?: string): Router {
  const router = Router();

  // GET /api/state — return full state
  router.get('/', (_req: Request, res: Response) => {
    const state = readState(statePath);
    res.json(state);
  });

  // PATCH /api/state — merge partial state update
  router.patch('/', (req: Request, res: Response) => {
    const { theme, openTabs, checkboxStates } = req.body;
    const sanitized: Partial<AppState> = {};
    if (theme === 'light' || theme === 'dark') sanitized.theme = theme;
    if (Array.isArray(openTabs)) sanitized.openTabs = openTabs;
    if (checkboxStates && typeof checkboxStates === 'object') sanitized.checkboxStates = checkboxStates;
    const updated = updateState(sanitized, statePath);
    res.json(updated);
  });

  return router;
}
