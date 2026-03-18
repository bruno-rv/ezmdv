import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjects,
  fetchProjectFiles,
  createProject,
  uploadFiles,
  deleteProject,
  renameProject as apiRenameProject,
  moveFile,
  createFolder,
  deleteFile as apiDeleteFile,
  mergeProjectInto,
  extractSubfolder as extractSubfolderApi,
  mergeSubfolderInto,
  type Project,
  type FileTreeEntry,
  type MoveFileResponse,
  type MergeProjectResponse,
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
      setProjects((prev) => {
        const existingById = new Map(prev.map((p) => [p.id, p]));
        return data.map((p) => {
          const existing = existingById.get(p.id);
          return {
            ...p,
            files: existing?.files,
            filesLoading: existing?.filesLoading ?? false,
          };
        });
      });
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

  const renameProject = useCallback(async (projectId: string, name: string) => {
    const updated = await apiRenameProject(projectId, name);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: updated.name } : p)),
    );
  }, []);

  const removeProject = useCallback(async (projectId: string) => {
    await deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  }, []);

  const removeProjects = useCallback(async (projectIds: string[]) => {
    await Promise.all(projectIds.map((id) => deleteProject(id)));
    const idSet = new Set(projectIds);
    setProjects((prev) => prev.filter((p) => !idSet.has(p.id)));
  }, []);

  const moveFileBetweenProjects = useCallback(
    async (
      destProjectId: string,
      sourceProjectId: string,
      sourceFilePath: string,
      destFilePath: string,
    ): Promise<MoveFileResponse> => {
      const result = await moveFile(destProjectId, sourceProjectId, sourceFilePath, destFilePath);
      if (result.sourceProjectDeleted) {
        setProjects((prev) => prev.filter((p) => p.id !== sourceProjectId));
      } else {
        await loadProjectFiles(sourceProjectId);
      }
      await loadProjectFiles(destProjectId);
      return result;
    },
    [loadProjectFiles],
  );

  const createProjectFolder = useCallback(
    async (projectId: string, folderPath: string) => {
      await createFolder(projectId, folderPath);
      await loadProjectFiles(projectId);
    },
    [loadProjectFiles],
  );

  const deleteProjectFile = useCallback(
    async (projectId: string, filePath: string) => {
      await apiDeleteFile(projectId, filePath);
      await loadProjectFiles(projectId);
    },
    [loadProjectFiles],
  );

  const mergeProject = useCallback(
    async (
      destProjectId: string,
      sourceProjectId: string,
    ): Promise<MergeProjectResponse> => {
      const result = await mergeProjectInto(destProjectId, sourceProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== sourceProjectId));
      await loadProjectFiles(destProjectId);
      return result;
    },
    [loadProjectFiles],
  );

  const extractSubfolder = useCallback(
    async (projectId: string, subfolderPath: string) => {
      const result = await extractSubfolderApi(projectId, subfolderPath);
      setProjects((prev) => [...prev, { ...result.project, files: undefined, filesLoading: false }]);
      await loadProjectFiles(projectId);
      return result;
    },
    [loadProjectFiles],
  );

  const mergeSubfolder = useCallback(
    async (destProjectId: string, sourceProjectId: string, subfolderPath: string) => {
      const result = await mergeSubfolderInto(destProjectId, sourceProjectId, subfolderPath);
      await Promise.all([
        loadProjectFiles(destProjectId),
        loadProjectFiles(sourceProjectId),
      ]);
      return result;
    },
    [loadProjectFiles],
  );

  const uploadToProject = useCallback(
    async (
      projectId: string,
      files: File[],
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
    renameProject,
    removeProject,
    removeProjects,
    uploadToProject,
    moveFileBetweenProjects,
    createProjectFolder,
    deleteProjectFile,
    mergeProject,
    extractSubfolder,
    mergeSubfolder,
  };
}
