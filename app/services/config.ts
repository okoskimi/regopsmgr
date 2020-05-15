import git, { Walker } from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Ajv from 'ajv';

import {
  ConfigFileMap,
  ConfigFile,
  SchemaConfigFile,
  MainConfigFile,
  Schema,
  SchemaMap,
  Category
} from '../reducers/types';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

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
      console.log('Looking at file', filepath);
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
      let configFile: ConfigFile | null = null;
      if (binaryData) {
        switch (path.extname(filepath)) {
          case '.yaml':
          case '.yml':
            console.log('Parsing Schema', filepath);
            if (filepath === 'config.yml') {
              configFile = {
                type: 'main',
                content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
              };
            } else {
              configFile = {
                type: 'schema',
                content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
              };
            }
            break;
          default:
            configFile = {
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
        content: configFile,
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

const isSchema = (file: ConfigFile): file is SchemaConfigFile => {
  return file.type === 'schema';
};

const isMain = (file: ConfigFile): file is MainConfigFile => {
  return file.type === 'main';
};

const commonMetaSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    extensions: {
      oneOf: [
        { type: 'string' },
        {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      ]
    },
    description: { type: 'string' },
    category: { type: 'string' },
    menuName: { type: 'string' },
    menuPriority: { type: 'number' },
    menuIcon: { type: 'string' }
  }
};

const metaSchemas: { [type: string]: Ajv.ValidateFunction } = {
  document: ajv.compile(commonMetaSchema),
  source: ajv.compile(commonMetaSchema),
  object: ajv.compile(commonMetaSchema)
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isString = (value: any): value is string => {
  return typeof value === 'string' || value instanceof String;
};

export const loadSchemas = (configs: ConfigFileMap): SchemaMap => {
  const schemas: SchemaMap = {
    byName: {},
    byExtension: {}
  };
  const prefix = `schema${path.sep}`;
  Object.keys(configs).forEach((filepath: string) => {
    const configFile = configs[filepath];
    if (filepath.startsWith(prefix) && isSchema(configFile)) {
      console.log('Validating schema', filepath);
      const schema = configFile.content;
      if (!isString(schema.type)) {
        throw new Error(`Schema at ${filepath} has an invalid type`);
      }
      const validator = metaSchemas[schema.type];
      if (!validator) {
        throw new Error(`Schema at ${filepath} has an unsupported type`);
      }
      if (!validator(schema)) {
        throw new Error(
          `Schema at ${filepath} is invalid: ${validator.errors}`
        );
      }
      // Only object schemas are used for JSON schema validation
      if (schema.type === 'object') {
        ajv.addSchema(schema, schema.name); // Throws exception if format is wrong
      }
      // At this point the schema is known to be OK, we can store it
      schemas.byName[schema.name] = schema;
      if (isString(schema.extensions)) {
        schemas.byExtension[schema.extensions] = schema;
      } else {
        schemas.byExtension = schema.extensions.reduce(
          (memo: Record<string, Schema>, ext: string) => ({
            ...memo,
            [ext]: schema
          }),
          {}
        );
      }
    }
  });
  return schemas;
};

const categorySchema = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    }
  }
};

export const loadCategories = (configs: ConfigFileMap): Array<Category> => {
  const validator = ajv.compile(categorySchema);
  const mainConfigFile = configs['config.yml'];
  if (!isMain(mainConfigFile)) {
    throw new Error('config.yml not available');
  }
  const config = mainConfigFile.content;
  if (!validator(config)) {
    throw new Error(
      `Config.yml contains invalid category information: ${validator.errors}`
    );
  }
  const categoryList: Array<Category> = [];
  const categoryMap: Record<string, Category> = {};
  for (let i = 0; config.categories.length; i++) {
    const category = {
      name: config.categories[i].name,
      id: config.categories[i].id,
      items: []
    };
    categoryList.push(category);
    categoryMap[category.id] = category;
  }
  const otherCategory = {
    name: 'Other',
    id: 'other',
    items: []
  };
  categoryList.push(otherCategory);
  categoryMap[otherCategory.id] = otherCategory;

  const prefix = `schema${path.sep}`;
  Object.keys(configs).forEach((filepath: string) => {
    const configFile = configs[filepath];
    if (filepath.startsWith(prefix) && isSchema(configFile)) {
      const schema = configFile.content;
      const category = categoryMap[schema.category] || otherCategory;
      category.items.push({
        name: schema.menuName,
        icon: schema.menuIcon,
        priority: schema.menuPriority,
        schema
      });
    }
  });
  categoryList.forEach(category =>
    category.items.sort((a, b) => a.priority - b.priority)
  );
  return categoryList;
};

export const validate = (type: string, obj: object) => {
  return ajv.validate(type, obj);
};
