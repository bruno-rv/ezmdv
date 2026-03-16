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
import { fuzzySearchProjectFiles } from '../fuzzySearch.js';
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
    const mode = typeof req.query.mode === 'string' ? req.query.mode : 'exact';
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
      score?: number;
    }> = [];

    for (const project of state.projects) {
      const files = collectMarkdownFiles(project.path);
      const projectResults = mode === 'fuzzy'
        ? fuzzySearchProjectFiles(files, query)
        : searchProjectFiles(files, query);
      for (const result of projectResults) {
        allResults.push({
          projectId: project.id,
          projectName: project.name,
          ...result,
        });
      }
    }

    if (mode === 'fuzzy') {
      allResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else {
      allResults.sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return a.filePath.localeCompare(b.filePath);
      });
    }

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
    const mode = typeof req.query.mode === 'string' ? req.query.mode : 'exact';
    if (!query.trim()) {
      res.json({ query, results: [] });
      return;
    }

    const files = collectMarkdownFiles(project.path);
    const results = mode === 'fuzzy'
      ? fuzzySearchProjectFiles(files, query)
      : searchProjectFiles(files, query);
    res.json({ query, results });
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

  // POST /api/projects/:id/create-file
  router.post('/:id/create-file', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;
    const { path: filePath } = req.body as { path: string };

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    if (!filePath.toLowerCase().endsWith('.md')) {
      res.status(400).json({ error: 'Only .md files can be created' });
      return;
    }

    const fullPath = path.join(project.path, filePath);
    if (!isPathWithinRoot(fullPath, project.path)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (fs.existsSync(fullPath)) {
      res.status(409).json({ error: 'File already exists' });
      return;
    }

    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '', 'utf-8');
      res.status(201).json({ created: filePath });
    } catch {
      res.status(500).json({ error: 'Failed to create file' });
    }
  });

  // POST /api/projects/:id/create-folder
  router.post('/:id/create-folder', withProject, (req: Request, res: Response) => {
    const { project } = req as ProjectRequest;
    const { path: folderPath } = req.body as { path: string };

    if (!folderPath || typeof folderPath !== 'string') {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const fullPath = path.join(project.path, folderPath);
    if (!isPathWithinRoot(fullPath, project.path)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (fs.existsSync(fullPath)) {
      res.status(409).json({ error: 'Folder already exists' });
      return;
    }

    try {
      fs.mkdirSync(fullPath, { recursive: true });
      res.status(201).json({ created: folderPath });
    } catch {
      res.status(500).json({ error: 'Failed to create folder' });
    }
  });

  // POST /api/projects/:id/merge-project
  router.post('/:id/merge-project', withProject, (req: Request, res: Response) => {
    const { project: destProject } = req as ProjectRequest;
    const { sourceProjectId } = req.body as { sourceProjectId?: string };

    if (!sourceProjectId) {
      res.status(400).json({ error: 'sourceProjectId is required' });
      return;
    }

    if (sourceProjectId === destProject.id) {
      res.status(400).json({ error: 'Cannot merge a project into itself' });
      return;
    }

    const state = readState(statePath);
    const sourceProject = state.projects.find((p) => p.id === sourceProjectId);
    if (!sourceProject) {
      res.status(404).json({ error: 'Source project not found' });
      return;
    }

    const sourceName = path.basename(sourceProject.path);
    const destSubfolder = path.join(destProject.path, sourceName);

    if (fs.existsSync(destSubfolder)) {
      res.status(409).json({ error: `Subfolder "${sourceName}" already exists in destination` });
      return;
    }

    function copyDirRecursive(src: string, dest: string, destRoot: string): void {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (!isPathWithinRoot(destPath, destRoot)) continue;
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          copyDirRecursive(srcPath, destPath, destRoot);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    try {
      copyDirRecursive(sourceProject.path, destSubfolder, destProject.path);
    } catch {
      res.status(500).json({ error: 'Failed to copy files' });
      return;
    }

    if (sourceProject.source === 'upload') {
      const uploadsRoot = path.resolve(path.join(os.homedir(), '.ezmdv', 'uploads'));
      if (isPathWithinRoot(sourceProject.path, uploadsRoot)) {
        try {
          fs.rmSync(sourceProject.path, { recursive: true, force: true });
        } catch {
          // best effort
        }
      }
    } else {
      state.dismissedCliPaths = state.dismissedCliPaths ?? [];
      if (!state.dismissedCliPaths.includes(sourceProject.path)) {
        state.dismissedCliPaths.push(sourceProject.path);
      }
    }

    state.projects = state.projects.filter((p) => p.id !== sourceProjectId);

    state.openTabs = state.openTabs.map((t) => {
      if (t.projectId === sourceProjectId) {
        return {
          projectId: destProject.id,
          filePath: `${sourceName}/${t.filePath}`,
        };
      }
      return t;
    });

    const newCheckboxStates: Record<string, Record<string, boolean>> = {};
    for (const [key, value] of Object.entries(state.checkboxStates)) {
      if (key.startsWith(`${sourceProjectId}:`)) {
        const filePart = key.slice(sourceProjectId.length + 1);
        newCheckboxStates[`${destProject.id}:${sourceName}/${filePart}`] = value;
      } else {
        newCheckboxStates[key] = value;
      }
    }
    state.checkboxStates = newCheckboxStates;

    updateState(
      {
        projects: state.projects,
        openTabs: state.openTabs,
        checkboxStates: state.checkboxStates,
        dismissedCliPaths: state.dismissedCliPaths,
      },
      statePath,
    );

    res.json({ merged: true, subfolderName: sourceName });
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

  // POST /api/projects/:id/move-file — move a file from another project
  router.post('/:id/move-file', withProject, (req: Request, res: Response) => {
    const { project: destProject } = req as ProjectRequest;
    const { sourceProjectId, sourceFilePath, destFilePath } = req.body as {
      sourceProjectId?: string;
      sourceFilePath?: string;
      destFilePath?: string;
    };

    if (!sourceProjectId || !sourceFilePath || !destFilePath) {
      res.status(400).json({ error: 'sourceProjectId, sourceFilePath, and destFilePath are required' });
      return;
    }

    if (!destFilePath.toLowerCase().endsWith('.md')) {
      res.status(400).json({ error: 'destFilePath must end with .md' });
      return;
    }

    const state = readState(statePath);
    const sourceProject = state.projects.find((p) => p.id === sourceProjectId);
    if (!sourceProject) {
      res.status(404).json({ error: 'Source project not found' });
      return;
    }

    const sourceFullPath = path.join(sourceProject.path, sourceFilePath);
    if (!isPathWithinRoot(sourceFullPath, sourceProject.path)) {
      res.status(403).json({ error: 'Source path access denied' });
      return;
    }

    const destFullPath = path.join(destProject.path, destFilePath);
    if (!isPathWithinRoot(destFullPath, destProject.path)) {
      res.status(403).json({ error: 'Destination path access denied' });
      return;
    }

    if (!fs.existsSync(sourceFullPath)) {
      res.status(404).json({ error: 'Source file not found' });
      return;
    }

    if (fs.existsSync(destFullPath)) {
      res.status(409).json({ error: 'Destination file already exists' });
      return;
    }

    try {
      const content = fs.readFileSync(sourceFullPath, 'utf-8');
      fs.mkdirSync(path.dirname(destFullPath), { recursive: true });
      fs.writeFileSync(destFullPath, content, 'utf-8');
      fs.unlinkSync(sourceFullPath);
    } catch {
      res.status(500).json({ error: 'Failed to move file' });
      return;
    }

    let sourceProjectDeleted = false;
    if (sourceProject.source === 'upload') {
      const remaining = listMarkdownFiles(sourceProject.path, sourceProject.path);
      if (remaining.length === 0) {
        const uploadsRoot = path.resolve(path.join(os.homedir(), '.ezmdv', 'uploads'));
        if (isPathWithinRoot(sourceProject.path, uploadsRoot)) {
          try {
            fs.rmSync(sourceProject.path, { recursive: true, force: true });
          } catch {
            // best effort
          }
        }
        state.projects = state.projects.filter((p) => p.id !== sourceProjectId);
        state.openTabs = state.openTabs.filter((t) => t.projectId !== sourceProjectId);
        updateState({ projects: state.projects, openTabs: state.openTabs }, statePath);
        sourceProjectDeleted = true;
      }
    }

    res.json({ moved: true, destFilePath, sourceProjectDeleted });
  });

  return router;
}
