import { promises as fsp } from 'fs';
import pathlib from 'path';
import YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import elog from 'electron-log';

import { database, setAssociation } from './database';
import { validate } from './config';
import { ObjectSchema, defaultSchema } from '../types/schema';
import { FILE_MODEL_ID, DIR_MODEL_ID } from '../constants/database';
import { saveYamlFile } from './yaml';
import { getGitStatus } from './git';

export const log = elog.scope('services/files');

// Get dirname from relative path and add initial slash
// Returns null for root directory (path equals '' or '/')
export const canonicalDirname = (path: string): string | null => {
  if (path === '' || path === '/') {
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

export const loadObjectFileToDatabase = async (
  path: string,
  gitDir: string,
  schema: ObjectSchema
): Promise<void> => {
  const fullPath = pathlib.join(gitDir, path);
  log.info(`Loading file ${path} of type ${schema.name}`);
  const contentStr = await fsp.readFile(fullPath, { encoding: 'utf8' });
  const contentObj = YAML.parse(contentStr);
  if (!contentObj.id) {
    // Force ID to be first property so that it is first in YAML file
    const yamlData = {
      id: uuidv4(),
      ...contentObj
    };
    log.info('Saving ID to ', path);
    await saveYamlFile(fullPath, yamlData);
    contentObj.id = yamlData.id;
  }

  const jsonObj = { ...contentObj };
  const [success, errors] = validate(schema.$id, contentObj);
  if (!success) {
    log.error('Could not validate:', contentObj);
    throw new Error(
      `${path} failed schema validation for ${
        schema.name
      } file ${path}: ${JSON.stringify(errors)}`
    );
  }
  const associations: { [x: string]: string | Array<string> } = {};
  Object.keys(contentObj).forEach(key => {
    if (schema.properties[key]) {
      const { type } = schema.properties[key];
      if (type === 'association') {
        associations[key] = contentObj[key];
        delete contentObj[key];
      } else if (type === 'array' || type === 'object') {
        delete contentObj[key];
      }
    } else {
      throw new Error(
        `Undefined schema property ${key} for ${path} on schema ${schema.name}`
      );
    }
  });
  const gitStatus = await getGitStatus(path, gitDir);
  contentObj._data = jsonObj;
  contentObj.created = new Date(gitStatus.created);
  contentObj.modified = new Date(gitStatus.modified);
  const associationPromises: Array<Promise<void>> = [];
  const model = database.models[schema.$id];
  if (!model) {
    throw new Error(
      `Database not properly initialized, model ${schema.name} missing`
    );
  }
  const instance = await model.create(contentObj);
  for (const key of Object.keys(associations)) {
    const association = associations[key];
    associationPromises.push(
      setAssociation(schema, instance, key, association)
    );
  }
  await Promise.all(associationPromises);
  const [dump] = await database.query('SELECT * FROM Risks');
  log.info('Database Risk table contents:', dump);

  const FileModel = database.models[FILE_MODEL_ID];
  const fileData = {
    path: canonicalPath(path),
    id: `uuid:${contentObj.id}`,
    shortId: contentObj.shortId,
    name: contentObj.name,
    description: contentObj.description
      ? contentObj.description
      : `${schema.name} file ${canonicalPath(path)}`,
    created: contentObj.created,
    modified: contentObj.modified,
    uncommittedChanges: gitStatus.uncommittedChanges,
    content: contentObj,
    schema: schema.$id,
    // Set association manually since we dont't have reference to parent object here
    dirId: canonicalDirname(path)
  };
  log.debug('Writing fileData to database:', fileData);
  await FileModel.create(fileData);
  log.debug('Write successful');
};

export const loadOtherFileToDatabase = async (
  path: string,
  gitDir: string
): Promise<void> => {
  log.info(`Loading other file ${path}`);
  const gitStatus = await getGitStatus(path, gitDir);
  const FileModel = database.models[FILE_MODEL_ID];
  const fileData = {
    path: canonicalPath(path),
    id: `file:${path}`,
    shortId: path,
    name: pathlib.basename(path),
    description: `${defaultSchema.name} file ${canonicalPath(path)}`,
    created: new Date(gitStatus.created),
    modified: new Date(gitStatus.modified),
    uncommittedChanges: gitStatus.uncommittedChanges,
    schema: defaultSchema.$id,
    dirId: canonicalDirname(path)
  };
  log.debug('Writing fileData to database:', fileData);
  await FileModel.create(fileData);
  log.debug('Write successful');
};

export const loadDirectoryToDatabase = async (path: string): Promise<void> => {
  log.info(`Loading directory ${path}`);
  const DirModel = database.models[DIR_MODEL_ID];
  const dirData = {
    path: canonicalPath(path),
    dirId: canonicalDirname(path)
  };
  log.debug('Writing dirData to database:', dirData);
  await DirModel.create(dirData);
  log.debug('Write successful');
};

export default {};
