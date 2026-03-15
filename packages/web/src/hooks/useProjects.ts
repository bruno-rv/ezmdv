import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjects,
  fetchProjectFiles,
  createProject,
  uploadFiles,
  type Project,
  type FileTreeEntry,
} from '@/lib/api';

export interface ProjectWithFiles extends Project {
  files?: FileTreeEntry[];
  filesLoading?: boolean;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithFiles[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(
        data.map((p) => ({ ...p, files: undefined, filesLoading: false })),
      );
    } catch {
      // Silently fail if backend is unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadProjectFiles = useCallback(async (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, filesLoading: true } : p,
      ),
    );
    try {
      const files = await fetchProjectFiles(projectId);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, files, filesLoading: false }
            : p,
        ),
      );
    } catch {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, filesLoading: false } : p,
        ),
      );
    }
  }, []);

  const addProject = useCallback(
    async (data: { name: string; path: string; source: 'cli' | 'upload' }) => {
      const project = await createProject(data);
      setProjects((prev) => [
        ...prev,
        { ...project, files: undefined, filesLoading: false },
      ]);
      return project;
    },
    [],
  );

  const uploadToProject = useCallback(
    async (
      projectId: string,
      files: FileList,
      relativePaths?: string[],
    ) => {
      await uploadFiles(projectId, files, relativePaths);
      // Refresh the file tree after upload
      await loadProjectFiles(projectId);
    },
    [loadProjectFiles],
  );

  return {
    projects,
    loading,
    loadProjects,
    loadProjectFiles,
    addProject,
    uploadToProject,
  };
}
