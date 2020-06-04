import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';
import { RouterState } from 'connected-react-router';

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
}

export type GetState = () => RootState;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<RootState, Action<string>>;
