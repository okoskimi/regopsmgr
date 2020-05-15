import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';

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
  categories: Array<Category>;
}

export type ConfigFile = BinaryConfigFile | SchemaConfigFile | MainConfigFile;

export interface ConfigFileMap {
  [path: string]: ConfigFile;
}

export interface Schema {
  type: string;
  name: string;
  extensions: string | Array<string>;
  description: string;
  menuName: string;
  menuIcon: string;
  menuPriority: number;
  category: string;
}

export interface SchemaMap {
  byName: {
    [name: string]: Schema;
  };
  byExtension: {
    [ext: string]: Schema;
  };
}

export interface MenuItem {
  name: string;
  icon: string;
  schema: object;
  priority: number;
}

export interface Category {
  name: string;
  id: string;
  items: Array<MenuItem>;
}

export interface RootState {
  counter: number;
  configFiles: ConfigFileMap;
  schemas: SchemaMap;
  categories: Array<Category>;
}

export type GetState = () => RootState;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<RootState, Action<string>>;
