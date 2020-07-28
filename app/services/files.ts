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

export interface AssociationData {
  modelId: string;
  instances: Array<string>;
}

export interface AssociationDataMap {
  [x: string]: AssociationData;
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
        const { target } = schema.properties[key];
        if (typeof target === 'string') {
          associations[key] = {
            modelId: target,
            instances: Array.isArray(contentObj[key])
              ? contentObj[key]
              : [contentObj[key]]
          };
        } else {
          throw new Error(
            `Target model for association ${key} in model ${schema.$id} is not a string`
          );
        }
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

export interface AssociationDefinition {
  target: string;
  relationship: string;
}

export interface SchemaExtractResult {
  contentSchema: ObjectSchema;
  associationNames: Array<string>;
  associationByName: {
    [name: string]: AssociationDefinition;
  };
}

export const extractAssociationsFromSchema = (
  schema: ObjectSchema
): SchemaExtractResult => {
  const result: SchemaExtractResult = {
    contentSchema: { ...schema },
    associationNames: [],
    associationByName: {}
  };
  Object.keys(result.contentSchema.properties).forEach(key => {
    const { type, target } = result.contentSchema.properties[key];
    if (type === 'association' && typeof target === 'string') {
      result.associationNames.push(key);
      result.associationByName[key] = (result.contentSchema.properties[
        key
      ] as unknown) as AssociationDefinition;
      delete result.contentSchema.properties[key];
    }
  });
  return result;
};

export default {};
