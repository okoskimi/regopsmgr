import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';
import { RouterState } from 'connected-react-router';
import { AssertionError } from 'assert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isString = (value: any): value is string => {
  return typeof value === 'string' || value instanceof String;
};

export function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new AssertionError({
      message: `Expected 'val' to be defined, but received ${val}`
    });
  }
}

export interface BinaryConfigFile {
  type: 'binary';
  content: Uint8Array;
}

export interface SchemaConfigFile {
  type: 'schema';
  content: Schema;
}

export interface MainConfigFile {
  type: 'main';
  content: MainConfig;
}

export interface MainConfig {
  home: MenuItem;
  categories: Array<MenuCategory>;
}

export type ConfigFile = BinaryConfigFile | SchemaConfigFile | MainConfigFile;

export const isSchema = (file: ConfigFile): file is SchemaConfigFile => {
  return file.type === 'schema';
};

export const isMain = (file: ConfigFile): file is MainConfigFile => {
  return file.type === 'main';
};

export interface ConfigFileState {
  [path: string]: ConfigFile;
}

export interface Schema {
  type: string;
  $id: string;
  name: string;
  collectiveName: string;
  description: string;
  icon: string;
  files: RegExp;
}

export interface ObjectSchema extends Schema {
  type: 'object';
  properties: {
    [name: string]: {
      type: string;
      [name: string]: string | object | number | boolean;
    };
  };
}

export const isObjectSchema = (schema: Schema): schema is ObjectSchema => {
  return schema.type === 'object';
};

export interface SchemaState {
  byId: {
    [id: string]: Schema;
  };
  data: Array<Schema>;
}

export interface MenuItem {
  name: string;
  icon: string;
  path: string;
  id: string;
}

export interface MenuCategory {
  name: string;
  items: Array<MenuItem>;
  id: string;
}

export interface AppMenuState {
  home: MenuItem;
  categories: Array<MenuCategory>;
}

export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARN = 'warning',
  ERROR = 'error'
}

export interface Notification {
  type: NotificationType;
  message: string;
  timestamp: number;
  id: string;
  seen: boolean;
}

export interface NotificationState {
  hasUnseenErrors: boolean;
  data: Array<Notification>;
}

export interface DatabaseState {
  version: number;
}

export interface DataFile {
  path: string;
  content?: object;
  schema?: Schema;
}

export interface Directory {
  name: string;
  files: Array<File>;
}

export type File = DataFile | Directory;

export interface FileState {
  list: Array<File>;
  structure: Directory;
}

export interface RootState {
  router: RouterState;
  counter: number;
  configFiles: ConfigFileState;
  schemas: SchemaState;
  appMenu: AppMenuState;
  notifications: NotificationState;
  database: DatabaseState;
}

export type GetState = () => RootState;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<RootState, Action<string>>;
