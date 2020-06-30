import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import chokidar from 'chokidar';
import pathlib from 'path';
import { produce } from 'immer';
import { AssertionError } from 'assert';
import elog from 'electron-log';

import { Dispatch, RootState } from '../types/store';
import { File, FileState, Directory } from '../types/file';
import { DatabaseState } from '../types/database';
import { Schema, SchemaState, isObjectSchema } from '../types/schema';
import { Notifier } from './notifications';
import { updateDatabase } from './database';
import { loadObjectFileToDatabase } from '../services/files';

const log = elog.scope('reducers/files');

interface FileEventAction {
  type: 'FILE_ADDED' | 'FILE_CHANGED' | 'FILE_REMOVED';
  file: File;
}

interface DirectoryEventAction {
  type: 'DIRECTORY_ADDED' | 'DIRECTORY_CHANGED' | 'DIRECTORY_REMOVED';
  path: string;
}

interface SetFilesAction {
  type: 'SET_FILES';
  files: FileList;
  directories: Array<string>;
}

type FileAction = FileEventAction | DirectoryEventAction | SetFilesAction;

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

export const fileAdded = (file: File): FileAction => ({
  type: 'FILE_ADDED',
  file
});

export const directoryAdded = (path: string): FileAction => ({
  type: 'DIRECTORY_ADDED',
  path
});

type FileList = Array<File>;

const initialPromises: Array<Promise<File>> = [];
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

  return async (dispatch: Dispatch) => {
    if (db.version !== 1 || schemas.data.length === 0) {
      // database not yet initialized or already done
      // or schemas not yet initialized
      return;
    }
    // Reset in case we run several times
    initialPromises.length = 0;
    initialFiles.length = 0;
    initialDirectories.length = 0;
    ready = false;
    if (watcher) {
      try {
        await watcher.close();
      } catch (ignore) {
        log.info('Error when closing on reset:', ignore);
      }
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
            const promise = loadObjectFileToDatabase(path, rootDir, schema);
            if (!ready) {
              initialPromises.push(promise);
              initialFiles.push({ path, schema });
            } else {
              const file = await promise;
              dispatch(updateDatabase());
              dispatch(fileAdded(file));
            }
          } catch (error) {
            log.info(`Unable to load ${path}: ${error}`);
            notify.error(`Unable to load ${path}: ${error}`);
          }
        } else if (!ready) {
          initialFiles.push({ name: pathlib.basename(path), path, schema });
        } else {
          dispatch(fileAdded({ name: pathlib.basename(path), path, schema }));
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
  if (!['FILE_ADDED', 'FILE_CHANGED', 'FILE_REMOVED'].includes(val.type)) {
    throw new AssertionError({
      message: `Expected 'val' to not be SetFilesAction: ${val}`
    });
  }
}

export function assertIsDirectoryEventAction(
  val: FileAction
): asserts val is DirectoryEventAction {
  if (
    !['DIRECTORY_ADDED', 'DIRECTORY_CHANGED', 'DIRECTORY_REMOVED'].includes(
      val.type
    )
  ) {
    throw new AssertionError({
      message: `Expected 'val' to not be SetFilesAction: ${val}`
    });
  }
}

// Convert dot to empty string
const canonicalDirname = (path: string): string => {
  const dir = pathlib.dirname(path);
  if (dir === '.') {
    return '';
  }
  return dir;
};

class FileStateClass {
  list: Array<File>;

  filesByPath: {
    [path: string]: File;
  };

  directoriesByPath: {
    [path: string]: Directory;
  };

  structure: Directory;

  base: string; // The directory that contains the .git directory. All paths are relative to this.

  constructor() {
    this.list = [];
    this.filesByPath = {};
    this.directoriesByPath = {};
    this.structure = {
      path: '.',
      subdirectories: [],
      files: []
    };
    this.base = pathlib.join(process.cwd(), '..', 'branchtest');
  }
}

const reducer = (
  state: FileState = new FileStateClass(),
  action: FileAction
): FileState => {
  const newState = new FileStateClass();
  switch (action.type) {
    case 'SET_FILES':
      assertIsSetFilesAction(action);
      log.info('Begin SET_FILES');
      action.directories.forEach(dir => {
        newState.directoriesByPath[dir] = {
          path: dir,
          subdirectories: [],
          files: []
        };
        log.info('Created directory record for ', dir);
      });
      action.directories.forEach(dir => {
        const parentDir = newState.directoriesByPath[canonicalDirname(dir)];
        if (parentDir) {
          parentDir.subdirectories.push(newState.directoriesByPath[dir]);
        } else {
          log.info('Root dir is ', dir);
          newState.structure = newState.directoriesByPath[dir];
        }
      });
      action.files.forEach(file => {
        const parentDir =
          newState.directoriesByPath[canonicalDirname(file.path)];
        if (parentDir) {
          parentDir.files.push(file);
        } else {
          throw new Error(
            `Parent directory not found for ${
              file.path
            } (looked for ${canonicalDirname(file.path)})`
          );
        }
        newState.list.push(file);
      });
      log.info('End SET_FILES ');
      log.info('Called produce, now returning: ', newState);
      return newState;
    // TODO: This does not work if a directory and files are added at the same time
    // - may get this event before the directory add event
    case 'FILE_ADDED':
      assertIsFileEventAction(action);
      return produce(state, draft => {
        const parentDir =
          draft.directoriesByPath[pathlib.dirname(action.file.path)];
        parentDir.files.push(action.file);
        draft.filesByPath[action.file.path] = action.file;
      });
    // TODO: This does not work if a directory and files are added at the same time
    // - may get this event after the file add events
    case 'DIRECTORY_ADDED':
      assertIsDirectoryEventAction(action);
      return produce(state, draft => {
        const parentDir = draft.directoriesByPath[pathlib.dirname(action.path)];
        const dir = {
          path: action.path,
          files: [],
          subdirectories: []
        };
        parentDir.subdirectories.push(dir);
        draft.directoriesByPath[action.path] = dir;
      });
    default:
      return state;
  }
};

export default reducer;
