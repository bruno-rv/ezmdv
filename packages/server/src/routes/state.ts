import { Router, type Request, type Response } from 'express';
import { readState, updateState } from '../state.js';

export function createStateRoutes(statePath?: string): Router {
  const router = Router();

  // GET /api/state — return full state
  router.get('/', (_req: Request, res: Response) => {
    const state = readState(statePath);
    res.json(state);
  });

  // PATCH /api/state — merge partial state update
  router.patch('/', (req: Request, res: Response) => {
    const partial = req.body;
    const updated = updateState(partial, statePath);
    res.json(updated);
  });

  return router;
}
