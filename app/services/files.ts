import pathlib from 'path';
import elog from 'electron-log';

import { Schema, defaultSchema } from '../types/schema';
import { SchemaState } from '../types/store';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = elog.scope('services/db/files');

const changeTime: {
  [path: string]: number;
} = {};

export const markAsChanged = (path: string) => {
  changeTime[path] = Date.now();
};

// Ignore changes reported up to one second after writing a file
export const wasChanged = (path: string): boolean => {
  if (changeTime[path]) {
    const timestamp = changeTime[path];
    delete changeTime[path]; // Only return true once for one change
    if (Math.abs(timestamp - Date.now()) < 3000) {
      return true;
    }
  }
  return false;
};

// Get dirname from relative path and add initial slash
// Returns null for root directory (path equals '' or '/' or '.')
export const canonicalDirname = (path: string): string | null => {
  if (path === '' || path === '/' || path === '.') {
    return null;
  }
  const dir = pathlib.dirname(path);
  if (dir === '.') {
    return '/';
  }
  return `/${dir}`;
};

// Return path with initial slash if not there already
export const canonicalPath = (path: string): string => {
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
};

// Get full path even when relative path begins with slash (as it does in database)
export const fullCanonicalPath = (baseDir: string, path: string): string => {
  const actualPath = path.startsWith('/') ? path.substring(1) : path;
  return pathlib.join(baseDir, actualPath);
};

export const relativePathFromCanonical = (path: string): string => {
  return path.startsWith('/') ? path.substring(1) : path;
};

export const selectSchema = (path: string, schemas: SchemaState): Schema => {
  for (const schema of schemas.data) {
    if (schema.files.test(path)) {
      return schema;
    }
  }
  return defaultSchema;
};

export default {};
