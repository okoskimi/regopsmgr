/*

import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import chokidar from 'chokidar';
import pathlib from 'path';
// import { produce } from 'immer';
// import { AssertionError } from 'assert';
import elog from 'electron-log';

import {
  Dispatch,
  RootState,
  SchemaState,
  DatabaseState
} from '../types/store';
// import { FileEntry } from '../types/file';
import { Schema, isObjectSchema } from '../types/schema';
import { Notifier } from './notifications';
import { updateDatabase, databaseReady } from './database';
import {
  loadObjectFileToDatabase,
  loadOtherFileToDatabase,
  loadDirectoryToDatabase
} from '../services/files';

const log = elog.scope('reducers/files');


interface FileEventAction {
  type: 'FILE_ADDED' | 'FILE_CHANGED' | 'FILE_REMOVED';
  file: FileEntry;
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

export const fileAdded = (file: FileEntry): FileAction => ({
  type: 'FILE_ADDED',
  file
});

export const directoryAdded = (path: string): FileAction => ({
  type: 'DIRECTORY_ADDED',
  path
});

type FileList = Array<FileEntry>;

const initialDirectories: Array<string> = [];

const initialPromises: Array<Promise<void>> = [];
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
  log.info('Initializing files');
  return async (dispatch: Dispatch) => {
    if (db.version !== 1 || schemas.data.length === 0) {
      // database not yet initialized or already done
      // or schemas not yet initialized
      log.info('Not yet', db.version, schemas.data.length);
      return;
    }
    // Reset in case we run several times

    initialPromises.length = 0;
    initialDirectories.length = 0;

    ready = false;

    if (watcher) {
      try {
        log.info('Closing existing file watcher');
        await watcher.close();
      } catch (ignore) {
        log.info('Error when closing on reset:', ignore);
      }
    }
    try {
      log.info(`Starting file watcher for ${rootDir}`);
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
            } else {
              await promise;
              dispatch(updateDatabase());
              // dispatch(fileAdded(file));
            }
          } catch (error) {
            log.info(`Unable to load /${path}: ${error}`);
            notify.error(`Unable to load /${path}: ${error}`);
          }
        } else {
          log.info('Loading other file:', path);
          try {
            const promise = loadOtherFileToDatabase(path, rootDir);
            if (!ready) {
              initialPromises.push(promise);
            } else {
              await promise;
              dispatch(updateDatabase());
              // dispatch(fileAdded(file));
            }
          } catch (error) {
            log.info(`Unable to load /${path}: ${error}`);
            notify.error(`Unable to load /${path}: ${error}`);
          }
        }
      });

      watcher.on('addDir', async path => {
        log.info('addDir', path);

        if (!ready) {
          initialDirectories.push(path);
        } else {
          dispatch(directoryAdded(path));
        }

        try {
          const promise = loadDirectoryToDatabase(path);
          if (!ready) {
            initialPromises.push(promise);
          } else {
            await promise;
            dispatch(updateDatabase());
            // dispatch(fileAdded(file));
          }
        } catch (error) {
          log.info(`Unable to load directory /${path}: ${error}`);
          notify.error(`Unable to load directory /${path}: ${error}`);
        }
      });

      watcher.on('ready', async () => {
        log.info('ready');
        ready = true;
        // Wait until all files have been processed before adding directory structure
        try {
          log.info('Got initialPromises: ', initialPromises);
          let successCount = 0;
          let failureCount = 0;
          const results = await Promise.allSettled(initialPromises);
          results.forEach(result => {
            if (result.status !== 'fulfilled') {
              log.error('Unable to load file:', result.reason);
              failureCount += 1;
            } else {
              successCount += 1;
            }
          });

          // dispatch(setFiles(initialFiles, initialDirectories));
          dispatch(databaseReady());
          log.info(`Loaded ${successCount} files to database`);
          notify.success(`Loaded ${successCount} files to database`);
          if (failureCount > 0) {
            log.error(`Failed to load ${failureCount} files to database`);
            notify.error(`Failed to load ${failureCount} files to database`);
          }
        } catch (error) {
          log.error('Unable to load files', error);
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

const reducer = (
  state: FileState = new FileState(),
  action: FileAction
): FileState => {
  const newState = new FileState();
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


export default {};
*/
