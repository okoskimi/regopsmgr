import git, { Walker } from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { ConfigFileMap, ConfigContent, SchemaMap } from '../reducers/types';

/*
 * Returns config file contents from <em>master</em> branch.
 */

export const getConfigFiles = async (dir: string): Promise<ConfigFileMap> => {
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

  /* Should we look for main dir first, or does library do it implicitly?
   *
  const gitroot = await git.findRoot({
    fs,
    filepath: dir
  }
  */

  const entryList = await git.walk({
    fs,
    dir,
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
      const binaryData = await tree.content();
      let content: ConfigContent | null = null;
      if (binaryData) {
        switch (path.extname(filepath)) {
          case '.yaml':
          case '.yml':
            console.log('Parsing Schema', filepath);
            content = {
              type: 'object',
              content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
            };
            break;
          default:
            content = {
              type: 'binary',
              content: binaryData
            };
        }
      }
      return {
        filepath,
        type: await tree.type(),
        mode: await tree.mode(),
        oid: await tree.oid(),
        content,
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

export const loadSchemas = (configs: ConfigFileMap): SchemaMap => {
  const schemas: SchemaMap = {};
  const prefix = `schema${path.sep}`;
  Object.keys(configs).forEach((filepath: string) => {
    if (filepath.startsWith(prefix) && configs[filepath].type === 'object') {
      const typeName = path.basename(filepath, path.extname(filepath));
      schemas[typeName] = configs[filepath];
    }
  });
  return schemas;
};
