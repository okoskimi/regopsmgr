import { promises as fsp } from 'fs';
import pathlib from 'path';
import YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import elog from 'electron-log';

import { validate } from './config';
import { ObjectSchema } from '../types/schema';
import { saveYamlFile } from './yaml';

const log = elog.scope('services/db/files');

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

export const loadYamlFile = async (
  schema: ObjectSchema,
  fullPath: string
): Promise<any> => {
  const contentStr = await fsp.readFile(fullPath, { encoding: 'utf8' });
  const contentObj = YAML.parse(contentStr);
  if (!contentObj.id) {
    // Force ID to be first property so that it is first in YAML file
    const yamlData = {
      id: uuidv4(),
      ...contentObj
    };
    log.info('Saving ID to ', fullPath);
    await saveYamlFile(fullPath, yamlData);
    contentObj.id = yamlData.id;
  }
  const [success, errors] = validate(schema.$id, contentObj);
  if (!success) {
    log.error('Could not validate:', contentObj);
    throw new Error(
      `Failed schema validation for schema ${schema}: ${JSON.stringify(errors)}`
    );
  }
  return contentObj;
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

export interface AssociationSchema {
  type: string;
  readOnly?: boolean;
}

export interface AssociationSchemaMap {
  [x: string]: AssociationSchema;
}

export interface SchemaExtractResult {
  contentSchema: ObjectSchema;
  associationSchemas: AssociationSchemaMap;
}

export const extractAssociationsFromSchema = (
  schema: ObjectSchema
): SchemaExtractResult => {
  const contentSchema = { ...schema };
  const associationSchemas: AssociationSchemaMap = {};
  Object.keys(contentSchema.properties).forEach(key => {
    const { type } = contentSchema.properties[key];
    if (type === 'association') {
      associationSchemas[key] = contentSchema.properties[key];
      delete contentSchema.properties[key];
    }
  });
  return {
    contentSchema,
    associationSchemas
  };
};

export default {};
