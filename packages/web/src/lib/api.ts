// API client for ezmdv backend

export interface Project {
  id: string;
  name: string;
  source: 'cli' | 'upload';
  path: string;
  lastOpened: string;
}

export interface FileTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeEntry[];
}

export interface Tab {
  projectId: string;
  filePath: string;
}

export interface GraphNode {
  id: string;
  label: string;
  filePath: string | null;
  dangling: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'wiki' | 'markdown';
  rawTarget: string;
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ProjectSearchResult {
  filePath: string;
  fileName: string;
  preview: string;
  matchCount: number;
  score?: number;
}

export interface ProjectSearchResponse {
  query: string;
  results: ProjectSearchResult[];
}

export interface FileMetadata {
  fileName: string;
  sizeBytes: number;
  lineCount: number;
  createdAt: string;
  modifiedAt: string;
  owner: string;
}

export interface AppState {
  theme: 'light' | 'dark';
  projects: Project[];
  openTabs: Tab[];
  checkboxStates: Record<string, Record<string, boolean>>;
}

const BASE_URL = window.location.origin;

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}

export async function fetchProjectFiles(
  projectId: string,
): Promise<FileTreeEntry[]> {
  return request<FileTreeEntry[]>(`/api/projects/${projectId}/files`);
}

export async function fetchFileContent(
  projectId: string,
  filePath: string,
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/api/projects/${projectId}/files/${filePath}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.text();
}

export async function fetchProjectGraph(
  projectId: string,
): Promise<ProjectGraph> {
  return request<ProjectGraph>(`/api/projects/${projectId}/graph`);
}

export async function searchProjectContent(
  projectId: string,
  query: string,
  mode?: 'exact' | 'fuzzy',
): Promise<ProjectSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (mode && mode !== 'exact') params.set('mode', mode);
  return request<ProjectSearchResponse>(
    `/api/projects/${projectId}/search?${params.toString()}`,
  );
}

export interface GlobalSearchResult {
  projectId: string;
  projectName: string;
  filePath: string;
  fileName: string;
  preview: string;
  matchCount: number;
  score?: number;
}

export interface GlobalSearchResponse {
  query: string;
  results: GlobalSearchResult[];
}

export async function searchAllProjects(
  query: string,
  mode?: 'exact' | 'fuzzy',
): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (mode && mode !== 'exact') params.set('mode', mode);
  return request<GlobalSearchResponse>(
    `/api/projects/search?${params.toString()}`,
  );
}

export async function createProject(data: {
  name: string;
  path: string;
  source: 'cli' | 'upload';
}): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<Project> {
  return request<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteProject(
  projectId: string,
): Promise<void> {
  await request(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function createFile(
  projectId: string,
  filePath: string,
): Promise<void> {
  await request(`/api/projects/${projectId}/create-file`, {
    method: 'POST',
    body: JSON.stringify({ path: filePath }),
  });
}

export async function saveFileContent(
  projectId: string,
  filePath: string,
  content: string,
): Promise<void> {
  await request(`/api/projects/${projectId}/files/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function uploadFiles(
  projectId: string,
  files: File[],
  relativePaths?: string[],
): Promise<void> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (relativePaths) {
    formData.append('relativePaths', JSON.stringify(relativePaths));
  }
  const res = await fetch(
    `${BASE_URL}/api/projects/${projectId}/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload error ${res.status}: ${body}`);
  }
}

export async function fetchFileMetadata(
  projectId: string,
  filePath: string,
): Promise<FileMetadata> {
  return request<FileMetadata>(
    `/api/projects/${projectId}/file-meta?path=${encodeURIComponent(filePath)}`,
  );
}

export interface MoveFileResponse {
  moved: boolean;
  destFilePath: string;
  sourceProjectDeleted: boolean;
}

export async function moveFile(
  destProjectId: string,
  sourceProjectId: string,
  sourceFilePath: string,
  destFilePath: string,
): Promise<MoveFileResponse> {
  return request<MoveFileResponse>(`/api/projects/${destProjectId}/move-file`, {
    method: 'POST',
    body: JSON.stringify({ sourceProjectId, sourceFilePath, destFilePath }),
  });
}

export async function createFolder(
  projectId: string,
  folderPath: string,
): Promise<void> {
  await request(`/api/projects/${projectId}/create-folder`, {
    method: 'POST',
    body: JSON.stringify({ path: folderPath }),
  });
}

export interface MergeProjectResponse {
  merged: boolean;
  subfolderName: string;
}

export async function mergeProjectInto(
  destProjectId: string,
  sourceProjectId: string,
): Promise<MergeProjectResponse> {
  return request<MergeProjectResponse>(
    `/api/projects/${destProjectId}/merge-project`,
    {
      method: 'POST',
      body: JSON.stringify({ sourceProjectId }),
    },
  );
}

export async function fetchState(): Promise<AppState> {
  return request<AppState>('/api/state');
}

export async function updateState(
  partial: Partial<AppState>,
): Promise<AppState> {
  return request<AppState>('/api/state', {
    method: 'PATCH',
    body: JSON.stringify(partial),
  });
}
