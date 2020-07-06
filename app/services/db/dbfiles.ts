import pathlib from 'path';
import elog from 'electron-log';

import { setAssociation } from './init';
import { database } from '.';
import { ObjectSchema, defaultSchema } from '../../types/schema';
import { FILE_MODEL_ID, DIR_MODEL_ID } from '../../constants/database';
import { getGitStatus } from '../git';
import {
  loadYamlFile,
  extractAssociationsFromData,
  canonicalPath,
  canonicalDirname,
  fullCanonicalPath
} from '../files';

const log = elog.scope('services/db/files');

export const loadObjectFileToDatabase = async (
  path: string,
  gitDir: string,
  schema: ObjectSchema
): Promise<void> => {
  try {
    const fullPath = fullCanonicalPath(gitDir, path);
    log.info(`Loading file ${path} of type ${schema.name}`);
    const jsonObj = await loadYamlFile(schema, fullPath);
    const { contentObj, associations } = extractAssociationsFromData(
      schema,
      jsonObj
    );
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
  } catch (error) {
    throw new Error(`Problem loading ${path}: ${error.toString()}`);
  }
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
