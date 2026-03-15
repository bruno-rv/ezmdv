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

export async function uploadFiles(
  projectId: string,
  files: FileList,
  relativePaths?: string[],
): Promise<void> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
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
