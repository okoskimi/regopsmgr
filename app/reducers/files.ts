import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import chokidar from 'chokidar';
import pathlib from 'path';
import { promises as fsp } from 'fs';
import YAML from 'yaml';
import { produce } from 'immer';
import { AssertionError } from 'assert';

import {
  FileState,
  DatabaseState,
  Schema,
  ObjectSchema,
  SchemaState,
  Dispatch,
  RootState,
  isObjectSchema
} from './types';
import { Notifier } from './notifications';
import { database, setAssociation } from '../services/database';
import { validate } from '../services/config';
import { updateDatabase } from './database';

interface FileEventAction {
  type:
    | 'FILE_ADDED'
    | 'FILE_CHANGED'
    | 'FILE_REMOVED'
    | 'DIRECTORY_ADDED'
    | 'DIRECTORY_CHANGED'
    | 'DIRECTORY_REMOVED'
    | 'SET_FILES';
  path: string;
  schema?: Schema;
}

interface SetFilesAction {
  type: 'SET_FILES';
  files: FileList;
  directories: Array<string>;
}

type FileAction = FileEventAction | SetFilesAction;

let watcher: chokidar.FSWatcher | null = null;

const loadFileToDatabase = async (path: string, schema: ObjectSchema) => {
  const contentStr = await fsp.readFile(path, { encoding: 'utf8' });
  const contentObj = YAML.parse(contentStr);
  const [success, errors] = validate(schema.$id, contentObj);
  if (!success) {
    throw new Error(
      `${path} failed schema validation for ${schema.name}: ${JSON.stringify(
        errors
      )}`
    );
  }
  const associations: { [x: string]: string | Array<string> } = {};
  Object.keys(contentObj).forEach(key => {
    if (schema.properties[key].type === 'association') {
      associations[key] = contentObj[key];
      delete contentObj[key];
    }
  });
  const associationPromises: Array<Promise<void>> = [];
  const instance = await database.models[schema.name].create(contentObj);
  for (const key of Object.keys(associations)) {
    const association = associations[key];
    associationPromises.push(
      setAssociation(schema, instance, key, association)
    );
  }
  await Promise.all(associationPromises);
};

export const setFiles = (
  files: FileList,
  directories: Array<string>
): FileAction => {
  return {
    type: 'SET_FILES',
    files,
    directories
  };
};

export const fileAdded = (
  path: string,
  schema: Schema | undefined
): FileAction => ({
  type: 'FILE_ADDED',
  path,
  schema
});

export const directoryAdded = (path: string): FileAction => ({
  type: 'DIRECTORY_ADDED',
  path
});

type FileList = Array<{ path: string; schema?: Schema }>;

const initialPromises: Array<Promise<void>> = [];
const initialFiles: FileList = [];
const initialDirectories: Array<string> = [];
let ready = false;

const selectSchema = (
  path: string,
  schemas: SchemaState
): Schema | undefined => {
  for (const schema of schemas.data) {
    if (schema.files.test(path)) {
      return schema;
    }
  }
  return undefined;
};

export const initFiles = (
  db: DatabaseState,
  schemas: SchemaState,
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  const rootDir = pathlib.join(process.cwd(), '..', 'branchtest');
  // Reset in case we run several times
  initialPromises.length = 0;
  initialFiles.length = 0;
  initialDirectories.length = 0;
  return async (dispatch: Dispatch) => {
    if (db.version === 0 || schemas.data.length === 0) {
      // database or schemas not yet initialized
      return;
    }
    try {
      watcher = chokidar.watch(rootDir, {
        cwd: rootDir
      });

      watcher.on('add', async path => {
        const schema = selectSchema(path, schemas);
        if (schema && isObjectSchema(schema)) {
          try {
            const promise = loadFileToDatabase(path, schema);
            if (!ready) {
              initialPromises.push(promise);
            } else {
              await promise;
            }
          } catch (error) {
            console.log(`Unable to load ${path}: ${error}`);
            notify.error(`Unable to load ${path}: ${error}`);
          }
        }
        if (!ready) {
          initialFiles.push({ path, schema });
        } else {
          dispatch(fileAdded(path, schema));
        }
      });

      watcher.on('addDir', path => {
        if (!ready) {
          initialDirectories.push(path);
        } else {
          dispatch(directoryAdded(path));
        }
      });

      watcher.on('ready', async () => {
        ready = true;
        // Wait until all files have been processed before adding directory structure
        try {
          await Promise.all(initialPromises);
          dispatch(setFiles(initialFiles, initialDirectories));
          dispatch(updateDatabase());
          console.log(`Loaded ${initialPromises.length} files to database`);
          notify.success(`Loaded ${initialPromises.length} files to database`);
        } catch (error) {
          console.log('Unable to load files', error);
          notify.error(`Unable to load files: ${error}`);
        }
      });

      dispatch(updateDatabase());
      console.log('Initialized database');
      notify.success(`Database initialized.`);
    } catch (error) {
      console.log('Unable to initialize files', error);
      notify.error(`Unable to initialize files: ${error}`);
    }
  };
};

export function assertIsSetFilesAction(
  val: FileAction
): asserts val is SetFilesAction {
  if (val.type !== 'SET_FILES') {
    throw new AssertionError({
      message: `Expected 'val' to be SetFilesAction: ${val}`
    });
  }
}

export function assertIsFileEventAction(
  val: FileAction
): asserts val is FileEventAction {
  if (val.type === 'SET_FILES') {
    throw new AssertionError({
      message: `Expected 'val' to not be SetFilesAction: ${val}`
    });
  }
}

const reducer = (
  state: FileState = {
    list: [],
    filesByPath: {},
    directoriesByPath: {},
    structure: {
      path: '.',
      subdirectories: [],
      files: []
    },
    base: pathlib.join(process.cwd(), '..', 'branchtest')
  },
  action: FileAction
): FileState => {
  switch (action.type) {
    case 'SET_FILES':
      assertIsSetFilesAction(action);
      return produce(state, draft => {
        action.directories.forEach(dir => {
          draft.directoriesByPath[dir] = {
            path: dir,
            subdirectories: [],
            files: []
          };
        });
        action.directories.forEach(dir => {
          const parentDir = draft.directoriesByPath[pathlib.dirname(dir)];
          if (parentDir) {
            parentDir.subdirectories.push(draft.directoriesByPath[dir]);
          } else {
            draft.structure = draft.directoriesByPath[dir];
          }
        });
        action.files.forEach(file => {
          const parentDir = draft.directoriesByPath[pathlib.dirname(file.path)];
          if (parentDir) {
            parentDir.files.push({
              ...file
            });
          } else {
            throw new Error(`Parent directory not found for ${file}`);
          }
        });
      }); // produce
    // TODO: This does not work if a directory and files are added at the same time
    // - may get this event before the directory add event
    case 'FILE_ADDED':
      assertIsFileEventAction(action);
      return produce(state, draft => {
        const parentDir = draft.directoriesByPath[pathlib.dirname(action.path)];
        parentDir.files.push({
          path: action.path,
          schema: action.schema
        });
      });
    // TODO: This does not work if a directory and files are added at the same time
    // - may get this event after the file add events
    case 'DIRECTORY_ADDED':
      assertIsFileEventAction(action);
      return produce(state, draft => {
        const parentDir = draft.directoriesByPath[pathlib.dirname(action.path)];
        parentDir.subdirectories.push({
          path: action.path,
          files: [],
          subdirectories: []
        });
      });
    default:
      return state;
  }
};

export default reducer;
