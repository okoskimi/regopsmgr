import { MenuItem, MenuCategory } from './app';
import { SchemaConfig } from './schema';

export interface BinaryConfigFile {
  type: 'binary';
  path: string;
  content: Uint8Array;
}
export interface SchemaConfigFile {
  type: 'schema';
  path: string;
  content: SchemaConfig;
}
export interface MainConfigFile {
  type: 'main';
  path: string;
  content: MainConfig;
}
export interface GlobalConfigFile {
  type: 'global';
  path: string;
  content: GlobalConfig;
}

export interface MainConfig {
  home: MenuItem;
  categories: Array<MenuCategory>;
}
export interface GlobalConfig {
  user: {
    name: string;
    email: string;
  };
  log: {
    console: string;
    file: string;
    ipc: string;
    remote: string;
  };
}

export type ConfigFile = BinaryConfigFile | SchemaConfigFile | MainConfigFile;
export const isSchemaConfigFile = (
  file: ConfigFile
): file is SchemaConfigFile => {
  return file.type === 'schema';
};
export const isMainConfigFile = (file: ConfigFile): file is MainConfigFile => {
  return file.type === 'main';
};
