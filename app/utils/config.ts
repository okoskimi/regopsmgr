import git, { Walker } from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export type ConfigFileMap = {
  [path: string]: Buffer;
};

export type SchemaMap = {
  [path: string]: object;
};

/*
 * Returns config file contents from <em>master</em> branch.
 */

export const configFiles = async (gitPath: string): Promise<ConfigFileMap> => {
  /*
  git.log({fs, dir})
      .then((commits: any) => {
          console.log(commits)
      })
  */
  const ref = 'master';
  const trees: Array<Walker> = [git.TREE({ ref })];
  const regOpsDir = '.regopsmgr';
  const pathPrefix = regOpsDir + path.sep;

  const entryList = await git.walk({
    fs,
    dir: gitPath,
    trees,
    map: async (filepath, entries) => {
      if (
        filepath !== '.' &&
        filepath !== regOpsDir &&
        !filepath.startsWith(pathPrefix)
      ) {
        return null;
      }
      if (entries === null) {
        return null;
      }
      const [tree] = entries;
      if (!tree) {
        return null;
      }
      const content = await tree.content();
      return {
        filepath,
        type: await tree.type(),
        mode: await tree.mode(),
        oid: await tree.oid(),
        content: content && Buffer.from(content).toString('utf8'),
        hasStat: !!(await tree.stat())
      };
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return entryList.reduce((result: any, cur: any) => {
    if (cur.type === 'blob') {
      return {
        ...result,
        [cur.filepath.substr(pathPrefix.length)]: cur.content
      };
    }
    return result;
  }, {});
};

export const loadSchemas = async (
  configs: ConfigFileMap
): Promise<SchemaMap> => {
  const schema: SchemaMap = {};
  const prefix = `schema${path.sep}`;
  const extension = '.yaml';
  Object.keys(configs).forEach((filepath: string) => {
    if (filepath.startsWith(prefix) && filepath.endsWith(extension)) {
      const typeName = filepath.substring(
        prefix.length,
        filepath.length - extension.length
      );
      console.log('Parsing Schema', filepath);
      schema[typeName] = YAML.parse(configs[filepath].toString());
    }
  });
  return schema;
};
