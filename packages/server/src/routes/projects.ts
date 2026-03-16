import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import multer from 'multer';
import { readState, updateState, type Project } from '../state.js';
import {
  buildProjectGraphFromFiles,
  collectMarkdownFiles,
  searchProjectFiles,
} from '../markdown.js';
import { IGNORED_DIRS } from '../constants.js';
import { isPathWithinRoot, projectLookup, type ProjectRequest } from '../security.js';

interface FileTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeEntry[];
}

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

  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

function resolveWildcardPath(req: Request): string | null {
  const raw = (req.params as Record<string, string | string[]>).filePath;
  const filePath = Array.isArray(raw) ? raw.join('/') : raw;
  return filePath || null;
}

export function createProjectRoutes(statePath?: string): Router {
  const router = Router();
  const withProject = projectLookup(statePath);

  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
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

  // PATCH /api/projects/:id — update project metadata
  router.patch('/:id', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;
    const { name } = req.body as { name?: string };
    if (name && typeof name === 'string') {
      project.name = name.trim();
    }

    const state = readState(statePath);
    const idx = state.projects.findIndex((p) => p.id === project.id);
    if (idx !== -1) state.projects[idx] = project;
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

    if (project.source === 'upload') {
      const uploadsRoot = path.resolve(path.join(os.homedir(), '.ezmdv', 'uploads'));
      if (isPathWithinRoot(project.path, uploadsRoot)) {
        try {
          const trashDir = path.join(os.homedir(), '.ezmdv', 'trash', project.id);
          fs.mkdirSync(trashDir, { recursive: true });
          fs.renameSync(project.path, path.join(trashDir, 'files'));
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
          try {
            fs.rmSync(project.path, { recursive: true, force: true });
          } catch {
            // Best effort
          }
        }
      }
    }

    state.projects.splice(projectIdx, 1);

    if (project.source === 'cli') {
      state.dismissedCliPaths = state.dismissedCliPaths ?? [];
      if (!state.dismissedCliPaths.includes(project.path)) {
        state.dismissedCliPaths.push(project.path);
      }
    }

    state.openTabs = state.openTabs.filter(
      (t) => t.projectId !== project.id,
    );

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
        dismissedCliPaths: state.dismissedCliPaths,
      },
      statePath,
    );

    res.json({ deleted: true });
  });

  // GET /api/projects/:id/file-meta
  router.get('/:id/file-meta', withProject, async (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;

    const filePath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!filePath) {
      res.status(400).json({ error: 'path query parameter is required' });
      return;
    }

    const fullPath = path.join(project.path, filePath);
    if (!isPathWithinRoot(fullPath, project.path)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const stat = await fs.promises.stat(fullPath);
      const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
      const lineCount = fileContent.split('\n').length;

      res.json({
        fileName: path.basename(fullPath),
        sizeBytes: stat.size,
        lineCount,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        owner: os.userInfo().username,
      });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // GET /api/projects/search — global search across all projects
  router.get('/search', (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (!query.trim()) {
      res.json({ query, results: [] });
      return;
    }

    const state = readState(statePath);
    const allResults: Array<{
      projectId: string;
      projectName: string;
      filePath: string;
      fileName: string;
      preview: string;
      matchCount: number;
    }> = [];

    for (const project of state.projects) {
      const files = collectMarkdownFiles(project.path);
      const projectResults = searchProjectFiles(files, query);
      for (const result of projectResults) {
        allResults.push({
          projectId: project.id,
          projectName: project.name,
          ...result,
        });
      }
    }

    allResults.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a.filePath.localeCompare(b.filePath);
    });

    res.json({ query, results: allResults });
  });

  // GET /api/projects/:id/files — list .md files
  router.get('/:id/files', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;
    const tree = listMarkdownFiles(project.path, project.path);
    res.json(tree);
  });

  // GET /api/projects/:id/graph
  router.get('/:id/graph', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;
    const files = collectMarkdownFiles(project.path);
    res.json(buildProjectGraphFromFiles(files));
  });

  // GET /api/projects/:id/search
  router.get('/:id/search', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;

    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (!query.trim()) {
      res.json({ query, results: [] });
      return;
    }

    const files = collectMarkdownFiles(project.path);
    res.json({
      query,
      results: searchProjectFiles(files, query),
    });
  });

  // GET /api/projects/:id/files/* — read a file
  router.get('/:id/files/*filePath', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;

    const filePath = resolveWildcardPath(req);
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }

    const fullPath = path.join(project.path, filePath);
    if (!isPathWithinRoot(fullPath, project.path)) {
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

  // PUT /api/projects/:id/files/* — write a file
  router.put('/:id/files/*filePath', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;

    const filePath = resolveWildcardPath(req);
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }

    const fullPath = path.join(project.path, filePath);
    if (!isPathWithinRoot(fullPath, project.path)) {
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

  // POST /api/projects/:id/upload
  router.post(
    '/:id/upload',
    withProject,
    upload.array('files'),
    (req: Request, res: Response) => {
      const { project } = req as ProjectRequest;

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

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

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath =
          relativePaths[i] || file.originalname;
        const destPath = path.join(uploadDir, relativePath);

        if (!isPathWithinRoot(destPath, uploadDir)) {
          fs.unlinkSync(file.path);
          continue;
        }

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.renameSync(file.path, destPath);
        savedFiles.push(relativePath);
      }

      res.json({ uploaded: savedFiles });
    },
  );

  return router;
}
