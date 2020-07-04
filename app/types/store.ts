/* eslint-disable max-classes-per-file */
import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';
import { RouterState } from 'connected-react-router';
// import pathlib from 'path';

import { ConfigFile } from './config';
import { Schema } from './schema';
import { MenuItem, MenuCategory, Notification } from './app';
// import { FileEntry, DirectoryEntry } from './file';

// Declaring state as classes allows initial data to be specified here rather than spread out in each reducer.
// Reducers create the initial state by creating an instance of the class.

export class ConfigFileState {
  byPath: {
    [path: string]: ConfigFile;
  };

  data: Array<ConfigFile>;

  constructor() {
    this.byPath = {};
    this.data = [];
  }
}

export class SchemaState {
  byId: {
    [id: string]: Schema;
  };

  data: Array<Schema>;

  constructor() {
    this.byId = {};
    this.data = [];
  }
}

export class AppMenuState {
  home: MenuItem;

  categories: Array<MenuCategory>;

  constructor() {
    this.home = {
      name: 'Dashboard',
      icon: '',
      path: '/',
      pathWithParams: '/',
      id: '1'
    };
    this.categories = [];
  }
}

export class NotificationState {
  hasUnseenErrors: boolean;

  data: Array<Notification>;

  constructor() {
    this.hasUnseenErrors = false;
    this.data = [];
  }
}

// version === 0: not initialized
// version === 1: initialized but no data
// version === 2: ready (has data)
// version > 2  : updated since ready
export class DatabaseState {
  version: number;

  constructor() {
    this.version = 0;
  }
}

/*
export class FileState {
  list: Array<FileEntry>;

  filesByPath: {
    [path: string]: FileEntry;
  };

  directoriesByPath: {
    [path: string]: DirectoryEntry;
  };

  structure: DirectoryEntry;

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
*/
export interface RootState {
  router: RouterState;
  counter: number;
  configFiles: ConfigFileState;
  schemas: SchemaState;
  appMenu: AppMenuState;
  notifications: NotificationState;
  database: DatabaseState;
  // files: FileState;
}

export type GetState = () => RootState;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<RootState, Action<string>>;
