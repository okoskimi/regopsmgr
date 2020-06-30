import { Schema } from './schema';

export interface File {
  path: string;
  id?: string;
  shortId?: string;
  name?: string;
  description?: string;
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
