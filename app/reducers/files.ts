import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import chokidar from 'chokidar';
import pathlib from 'path';
import { produce } from 'immer';
import { AssertionError } from 'assert';
import elog from 'electron-log';

import {
  FileState,
  DatabaseState,
  Schema,
  SchemaState,
  Dispatch,
  RootState,
  isObjectSchema
} from './types';
import { Notifier } from './notifications';
import { updateDatabase } from './database';
import { loadFileToDatabase } from '../services/files';

const log = elog.scope('reducers/files');

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
    if (db.version !== 1 || schemas.data.length === 0) {
      // database not yet initialized or already done
      // or schemas not yet initialized
      return;
    }
    try {
      watcher = chokidar.watch(rootDir, {
        cwd: rootDir,
        ignored: /(^|[/\\])\../ // ignore dotfiles
      });

      watcher.on('add', async path => {
        log.info('add', path);
        const schema = selectSchema(path, schemas);
        if (schema && isObjectSchema(schema)) {
          log.info('Loading to database:', path, 'with schema:', schema.name);
          try {
            const promise = loadFileToDatabase(
              pathlib.join(rootDir, path),
              rootDir,
              schema
            );
            if (!ready) {
              initialPromises.push(promise);
            } else {
              await promise;
              dispatch(updateDatabase());
            }
          } catch (error) {
            log.info(`Unable to load ${path}: ${error}`);
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
        log.info('addDir', path);
        if (!ready) {
          initialDirectories.push(path);
        } else {
          dispatch(directoryAdded(path));
        }
      });

      watcher.on('ready', async () => {
        log.info('ready');
        ready = true;
        // Wait until all files have been processed before adding directory structure
        try {
          await Promise.all(initialPromises);
          dispatch(setFiles(initialFiles, initialDirectories));
          dispatch(updateDatabase());
          log.info(`Loaded ${initialPromises.length} files to database`);
          notify.success(`Loaded ${initialPromises.length} files to database`);
        } catch (error) {
          log.info('Unable to load files', error);
          notify.error(`Unable to load files: ${error}`);
        }
      });
    } catch (error) {
      log.info('Unable to initialize files', error);
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
