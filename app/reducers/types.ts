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
  content: SchemaConfig;
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

export const isSchemaConfigFile = (
  file: ConfigFile
): file is SchemaConfigFile => {
  return file.type === 'schema';
};

export const isMainConfigFIle = (file: ConfigFile): file is MainConfigFile => {
  return file.type === 'main';
};

export interface ConfigFileState {
  [path: string]: ConfigFile;
}

export interface SchemaBase {
  type: string;
  $id: string;
  name: string;
  collectiveName: string;
  description: string;
  icon: string;
}

export interface SchemaConfig extends SchemaBase {
  files: string;
}

export interface ObjectSchemaConfig extends SchemaConfig {
  type: 'object';
  properties: {
    [name: string]: {
      type: string;
      [name: string]: string | object | number | boolean;
    };
  };
  validation?: string;
}

export const isObjectSchemaConfig = (
  schema: SchemaConfig
): schema is ObjectSchemaConfig => {
  return schema.type === 'object';
};

export interface Schema extends SchemaBase {
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
  validation?: string;
}

export const isObjectSchema = (schema: Schema): schema is ObjectSchema => {
  return schema.type === 'object';
};

export const getSchema = (config: SchemaConfig): Schema => {
  if (isObjectSchemaConfig(config)) {
    const os: ObjectSchema = {
      ...config,
      properties: {
        ...config.properties,
        id: {
          type: 'string',
          maxLength: 255,
          // UUIDv4 regex
          pattern:
            '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
        },
        shortId: { type: 'string', maxLength: 255 },
        name: { type: 'string', maxLength: 255 }
      },
      files: new RegExp(config.files)
    };
    return os;
  }
  return { ...config, files: new RegExp(config.files) };
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

export interface File {
  path: string;
  content?: object;
  schema?: Schema;
}

export interface Directory {
  path: string;
  subdirectories: Array<Directory>;
  files: Array<File>;
}

export interface FileState {
  list: Array<File>;
  filesByPath: {
    [path: string]: File;
  };
  directoriesByPath: {
    [path: string]: Directory;
  };
  structure: Directory;
  base: string; // The directory that contains the .git directory. All paths are relative to this.
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
