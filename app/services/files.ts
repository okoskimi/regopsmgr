import pathlib from 'path';
import elog from 'electron-log';

import { ObjectSchema } from '../types/schema';

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

export interface AssociationDataMap {
  [x: string]: string | Array<string>;
}

export interface DataExtractResult {
  contentObj: any;
  associations: AssociationDataMap;
}
export const extractAssociationsFromData = (
  schema: ObjectSchema,
  data: any,
  removeNested = true
): DataExtractResult => {
  const contentObj = { ...data };
  const associations: AssociationDataMap = {};
  Object.keys(contentObj).forEach(key => {
    if (schema.properties[key]) {
      const { type } = schema.properties[key];
      if (type === 'association') {
        associations[key] = contentObj[key];
        delete contentObj[key];
      } else if (removeNested && (type === 'array' || type === 'object')) {
        delete contentObj[key];
      }
    } else {
      throw new Error(
        `Undefined schema property ${key} on schema ${schema.name}`
      );
    }
  });
  return {
    contentObj,
    associations
  };
};

export interface SchemaExtractResult {
  contentSchema: ObjectSchema;
  associationNames: Array<string>;
}

export const extractAssociationsFromSchema = (
  schema: ObjectSchema
): SchemaExtractResult => {
  const contentSchema = { ...schema };
  const associationNames: Array<string> = [];
  Object.keys(contentSchema.properties).forEach(key => {
    const { type } = contentSchema.properties[key];
    if (type === 'association') {
      associationNames.push(key);
      delete contentSchema.properties[key];
    }
  });
  return {
    contentSchema,
    associationNames
  };
};

export default {};
