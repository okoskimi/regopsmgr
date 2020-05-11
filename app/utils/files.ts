import dir from 'node-dir';
import path from 'path';
import { SchemaMap } from '../reducers/types';

export type FileMap = {
  [type: string]: string[];
};

export const OTHER_FILES = 'OTHER_FILES';

export const fileList = async (
  filepath: string,
  schemas: SchemaMap
): Promise<FileMap> => {
  const files = await dir.promiseFiles(filepath);
  const fileMap: FileMap = {};
  Object.keys(schemas).forEach((type: string) => {
    fileMap[type] = [];
  });
  fileMap[OTHER_FILES] = [];
  files.forEach((file: string) => {
    const extension = path.extname(file);
    if (fileMap[extension]) {
      fileMap[extension].push(file);
    } else {
      fileMap[OTHER_FILES].push(file);
    }
  });
  return fileMap;
};
