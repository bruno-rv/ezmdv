import fs from 'node:fs';
import path from 'node:path';

export interface ResolvedTarget {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

/**
 * Resolves a CLI target path (file or directory) into a normalized target object.
 * - If the path is a file: name = filename without .md extension, path = parent directory
 * - If the path is a directory: name = directory name, path = the directory
 * Throws if the path does not exist.
 */
export function resolveTarget(targetPath: string): ResolvedTarget {
  const absolutePath = path.resolve(targetPath);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  if (stat.isFile()) {
    const fileName = path.basename(absolutePath);
    const name = fileName.replace(/\.md$/i, '');
    return {
      name,
      path: path.dirname(absolutePath),
      type: 'file',
    };
  }

  if (stat.isDirectory()) {
    return {
      name: path.basename(absolutePath),
      path: absolutePath,
      type: 'directory',
    };
  }

  throw new Error(`Path is neither a file nor a directory: ${absolutePath}`);
}
