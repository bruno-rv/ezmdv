import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import multer from 'multer';
import { readState, updateState, type Project } from '../state.js';

interface FileTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeEntry[];
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.ezmdv',
  'dist',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '__pycache__',
  '.venv',
  'vendor',
]);

function listMarkdownFiles(
  dirPath: string,
  basePath: string,
): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];

  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return entries;
  }

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.relative(basePath, fullPath);

    if (item.isDirectory()) {
      if (IGNORED_DIRS.has(item.name)) continue;
      const children = listMarkdownFiles(fullPath, basePath);
      if (children.length > 0) {
        entries.push({
          name: item.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      }
    } else if (
      item.isFile() &&
      item.name.toLowerCase().endsWith('.md')
    ) {
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'file',
      });
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export function createProjectRoutes(statePath?: string): Router {
  const router = Router();

  // Multer storage for uploads
  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      // Will be set per-request in the route handler
      cb(null, os.tmpdir());
    },
    filename(_req, file, cb) {
      cb(null, file.originalname);
    },
  });

  const upload = multer({ storage });

  // GET /api/projects — list all projects
  router.get('/', (_req: Request, res: Response) => {
    const state = readState(statePath);
    res.json(state.projects);
  });

  // POST /api/projects — create a project
  router.post('/', (req: Request, res: Response) => {
    const { name, path: projectPath, source } = req.body as {
      name: string;
      path: string;
      source: 'cli' | 'upload';
    };

    if (!name || !source) {
      res.status(400).json({ error: 'name and source are required' });
      return;
    }

    // For upload projects, auto-generate the path under ~/.ezmdv/uploads/<name>/
    let resolvedPath: string;
    if (source === 'upload') {
      const safeName = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
      resolvedPath = path.join(os.homedir(), '.ezmdv', 'uploads', safeName);
      fs.mkdirSync(resolvedPath, { recursive: true });
    } else {
      if (!projectPath) {
        res.status(400).json({ error: 'path is required for non-upload projects' });
        return;
      }
      resolvedPath = projectPath;
    }

    const project: Project = {
      id: uuidv4(),
      name,
      source,
      path: resolvedPath,
      lastOpened: new Date().toISOString(),
    };

    const state = readState(statePath);
    state.projects.push(project);
    updateState({ projects: state.projects }, statePath);

    res.status(201).json(project);
  });

  // PATCH /api/projects/:id — update project metadata (e.g. rename)
  router.patch('/:id', (req: Request, res: Response) => {
    const state = readState(statePath);
    const project = state.projects.find((p) => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { name } = req.body as { name?: string };
    if (name && typeof name === 'string') {
      project.name = name.trim();
    }

    updateState({ projects: state.projects }, statePath);
    res.json(project);
  });

  // DELETE /api/projects/:id — delete a project
  router.delete('/:id', (req: Request, res: Response) => {
    const state = readState(statePath);
    const projectIdx = state.projects.findIndex((p) => p.id === req.params.id);

    if (projectIdx === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = state.projects[projectIdx];

    // For upload projects, move files to trash instead of deleting
    if (project.source === 'upload') {
      const uploadsRoot = path.resolve(path.join(os.homedir(), '.ezmdv', 'uploads'));
      const resolvedProjectPath = path.resolve(project.path);
      if (resolvedProjectPath.startsWith(uploadsRoot + path.sep)) {
        try {
          const trashDir = path.join(os.homedir(), '.ezmdv', 'trash', project.id);
          fs.mkdirSync(trashDir, { recursive: true });
          fs.renameSync(project.path, path.join(trashDir, 'files'));
          // Write metadata so we know what this was
          fs.writeFileSync(
            path.join(trashDir, 'meta.json'),
            JSON.stringify({
              name: project.name,
              source: project.source,
              deletedAt: new Date().toISOString(),
            }),
            'utf-8',
          );
        } catch {
          // Fallback: if move fails (cross-device), delete directly
          try {
            fs.rmSync(project.path, { recursive: true, force: true });
          } catch {
            // Best effort
          }
        }
      }
    }

    // Remove project from state
    state.projects.splice(projectIdx, 1);

    // Close any open tabs belonging to this project
    state.openTabs = state.openTabs.filter(
      (t) => t.projectId !== project.id,
    );

    // Clean up checkbox states for this project
    for (const key of Object.keys(state.checkboxStates)) {
      if (key.startsWith(`${project.id}:`)) {
        delete state.checkboxStates[key];
      }
    }

    updateState(
      {
        projects: state.projects,
        openTabs: state.openTabs,
        checkboxStates: state.checkboxStates,
      },
      statePath,
    );

    res.json({ deleted: true });
  });

  // GET /api/projects/:id/files — list .md files in project directory
  router.get('/:id/files', (req: Request, res: Response) => {
    const state = readState(statePath);
    const project = state.projects.find((p) => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const tree = listMarkdownFiles(project.path, project.path);
    res.json(tree);
  });

  // GET /api/projects/:id/files/* — read a specific markdown file
  // Express 5 requires named wildcard parameters
  router.get('/:id/files/*filePath', (req: Request, res: Response) => {
    const state = readState(statePath);
    const project = state.projects.find((p) => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // In Express 5, wildcard params can be an array of path segments
    const rawFilePath = (req.params as Record<string, string | string[]>).filePath;
    const filePath = Array.isArray(rawFilePath)
      ? rawFilePath.join('/')
      : rawFilePath;
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }

    const fullPath = path.join(project.path, filePath);

    // Security: ensure the resolved path is within the project directory
    const resolved = path.resolve(fullPath);
    const projectRoot = path.resolve(project.path);
    if (!resolved.startsWith(projectRoot)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.type('text/plain').send(content);
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // PUT /api/projects/:id/files/* — update a specific markdown file
  router.put('/:id/files/*filePath', (req: Request, res: Response) => {
    const state = readState(statePath);
    const project = state.projects.find((p) => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const rawFilePath = (req.params as Record<string, string | string[]>).filePath;
    const filePath = Array.isArray(rawFilePath)
      ? rawFilePath.join('/')
      : rawFilePath;
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }

    const fullPath = path.join(project.path, filePath);

    // Security: ensure the resolved path is within the project directory
    const resolved = path.resolve(fullPath);
    const projectRoot = path.resolve(project.path);
    if (!resolved.startsWith(projectRoot)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { content } = req.body as { content: string };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content (string) is required' });
      return;
    }

    try {
      fs.writeFileSync(fullPath, content, 'utf-8');
      res.json({ saved: true });
    } catch {
      res.status(500).json({ error: 'Failed to write file' });
    }
  });

  // POST /api/projects/:id/upload — upload files
  router.post(
    '/:id/upload',
    upload.array('files'),
    (req: Request, res: Response) => {
      const state = readState(statePath);
      const project = state.projects.find((p) => p.id === req.params.id);

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      // relativePaths is sent as a JSON array or comma-separated string
      const relativePathsRaw = req.body.relativePaths as
        | string
        | string[]
        | undefined;
      let relativePaths: string[] = [];
      if (Array.isArray(relativePathsRaw)) {
        relativePaths = relativePathsRaw;
      } else if (typeof relativePathsRaw === 'string') {
        try {
          relativePaths = JSON.parse(relativePathsRaw);
        } catch {
          relativePaths = relativePathsRaw.split(',');
        }
      }

      const uploadDir = project.path;
      const savedFiles: string[] = [];
      const resolvedUploadDir = path.resolve(uploadDir);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath =
          relativePaths[i] || file.originalname;
        const destPath = path.join(uploadDir, relativePath);
        const resolvedDest = path.resolve(destPath);

        // Security: prevent path traversal
        if (!resolvedDest.startsWith(resolvedUploadDir)) {
          // Clean up the temp file and skip — path traversal attempt
          fs.unlinkSync(file.path);
          continue;
        }

        // Ensure parent directory exists
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        // Move from temp to destination
        fs.renameSync(file.path, destPath);
        savedFiles.push(relativePath);
      }

      res.json({ uploaded: savedFiles });
    },
  );

  return router;
}
