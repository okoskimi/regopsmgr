import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import chokidar from 'chokidar';
import pathlib from 'path';
import elog from 'electron-log';

import { Notifier } from './notifications';
import { Schema, isObjectSchema } from '../types/schema';
import {
  Dispatch,
  RootState,
  ConfigFileState,
  DatabaseState,
  SchemaState
} from '../types/store';
import { initDatabase as doInitDatabase } from '../services/database';
import {
  loadObjectFileToDatabase,
  loadOtherFileToDatabase,
  loadDirectoryToDatabase
} from '../services/files';

const log = elog.scope('reducers/database');

// const STATE_CREATED = 0;
const STATE_INITIALIZED = 1;
const STATE_READY = 2;

// State
let watcher: chokidar.FSWatcher | null = null;
const initialPromises: Array<Promise<void>> = [];
let ready = false;

interface UpdateDatabaseAction {
  type: 'UPDATE_DATABASE';
}

interface SetDatabaseVersionAction {
  type: 'SET_DATABASE_VERSION';
  version: number;
}

type DatabaseAction = UpdateDatabaseAction | SetDatabaseVersionAction;

export const updateDatabase = (): DatabaseAction => {
  return {
    type: 'UPDATE_DATABASE'
  };
};

export const databaseInitialized = (): DatabaseAction => {
  return {
    type: 'SET_DATABASE_VERSION',
    version: STATE_INITIALIZED
  };
};

export const databaseReady = (): DatabaseAction => {
  return {
    type: 'SET_DATABASE_VERSION',
    version: STATE_READY
  };
};

export const databaseIsInitialized = (db: DatabaseState): boolean => {
  return db.version >= STATE_INITIALIZED;
};

export const databaseIsReady = (db: DatabaseState): boolean => {
  return db.version >= STATE_READY;
};

export const initDatabase = (
  configs: ConfigFileState,
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    if (configs.data.length === 0) {
      // initial call with no data
      return;
    }
    try {
      await doInitDatabase(configs);
      dispatch(databaseInitialized());
      log.info('Initialized database');
      notify.success(`Database initialized.`);
    } catch (error) {
      log.info('Unable to initialize database', error);
      notify.error(`Unable to initialize database: ${error}`);
    }
  };
};

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

export const loadFilesToDatabase = (
  db: DatabaseState,
  schemas: SchemaState,
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  const rootDir = pathlib.join(process.cwd(), '..', 'branchtest');
  log.info('Initializing files');
  return async (dispatch: Dispatch) => {
    if (db.version !== STATE_INITIALIZED || schemas.data.length === 0) {
      // database not yet initialized or already done
      // or schemas not yet initialized
      log.info('Not yet', db.version, schemas.data.length);
      return;
    }
    // Reset in case we run several times
    initialPromises.length = 0;
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
            }
          } catch (error) {
            log.info(`Unable to load /${path}: ${error}`);
            notify.error(`Unable to load /${path}: ${error}`);
          }
        }
      });

      watcher.on('addDir', async path => {
        log.info('addDir', path);
        try {
          const promise = loadDirectoryToDatabase(path);
          if (!ready) {
            initialPromises.push(promise);
          } else {
            await promise;
            dispatch(updateDatabase());
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

const reducer = (
  state: DatabaseState = new DatabaseState(),
  action: DatabaseAction
): DatabaseState => {
  switch (action.type) {
    case 'UPDATE_DATABASE':
      return { version: state.version + 1 };
    case 'SET_DATABASE_VERSION':
      return { version: action.version };
    default:
      return state;
  }
};

export default reducer;
