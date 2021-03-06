import git, { Walker } from 'isomorphic-git';
import { ValidateFunction } from 'ajv';
import fs from 'fs';
import { app } from 'electron';
import path from 'path';
import YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import produce from 'immer';
import elog from 'electron-log';

import { isString } from '../types/util';
import { AppMenuState, SchemaState, ConfigFileState } from '../types/store';
import { getSchema, isObjectSchemaConfig } from '../types/schema';
import {
  ConfigFile,
  isSchemaConfigFile,
  isMainConfigFile,
  GlobalConfigFile,
  GlobalConfig
} from '../types/config';
import { loadYamlFile, saveYamlFile } from './yaml';
import { compileSchema, resetSchemas, addSchema } from '../types/validation';

const log = elog.scope('services/config');

const GLOBAL_CONFIG_FILE_NAME = 'RegOpsMgrConfig.yml';

/*
 * Returns config file contents from <em>master</em> branch.
 */

export const getConfigFilesFromGit = async (
  dir: string
): Promise<ConfigFileState> => {
  /*
  git.log({fs, dir})
      .then((commits: any) => {
          log.info(commits)
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
      log.info('Looking at file', filepath);
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
            try {
              log.info('Parsing Schema', filepath);
              if (filepath.substr(pathPrefix.length) === 'config.yml') {
                configFile = {
                  type: 'main',
                  path: filepath.substr(pathPrefix.length),
                  content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
                };
              } else {
                configFile = {
                  type: 'schema',
                  path: filepath.substr(pathPrefix.length),
                  content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
                };
              }
            } catch (error) {
              throw new Error(
                `Unable to parse configuration file ${filepath}: ${error}\nBEGIN\n${Buffer.from(
                  binaryData
                ).toString('utf8')}\nEND`
              );
            }
            break;
          default:
            configFile = {
              type: 'binary',
              path: filepath.substr(pathPrefix.length),
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
  return entryList.reduce(
    (result: any, cur: any) => {
      if (cur.type === 'blob') {
        return {
          byPath: {
            ...result.byPath,
            [cur.filepath.substr(pathPrefix.length)]: cur.content
          },
          data: [...result.data, cur.content]
        };
      }
      return result;
    },
    { byPath: {}, data: [], global: null }
  );
};

const commonMetaSchema = compileSchema({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    collectiveName: { type: 'string', minLength: 2 },
    files: { type: 'string', minLength: 3 },
    description: { type: 'string' },
    icon: { type: 'string' }
  }
});

// TODO: Make type-specific schemas
const metaSchemas: { [type: string]: ValidateFunction } = {
  document: commonMetaSchema,
  source: commonMetaSchema,
  object: commonMetaSchema,
  image: commonMetaSchema
};

const hasAssociations = (obj: any): boolean => {
  if (!obj) {
    return false;
  }
  if (obj.type === 'association') {
    return true;
  }
  if (obj.type === 'array') {
    if (obj.items) {
      if (hasAssociations(obj.items)) {
        return true;
      }
    }
  }
  if (obj.type === 'object') {
    if (obj.properties) {
      for (const key of Object.keys(obj.properties)) {
        if (hasAssociations(obj.properties[key])) {
          return true;
        }
      }
    }
  }
  return false;
};

export const loadSchemas = (configs: ConfigFileState): SchemaState => {
  // Reset schema instance, because added schemas cannot be updated
  resetSchemas();
  const schemas: SchemaState = {
    byId: {},
    data: []
  };
  log.debug('Loading schemas from configs: ', configs.data);
  const prefix = `schema${path.sep}`;
  configs.data.forEach(configFile => {
    const filepath = configFile.path;
    if (filepath.startsWith(prefix) && isSchemaConfigFile(configFile)) {
      log.info('Validating schema', filepath, configFile);
      const schemaConfig = configFile.content;
      if (!isString(schemaConfig.type)) {
        throw new Error(`Schema at ${filepath} has an invalid type`);
      }
      if (schemaConfig.$id.startsWith('_')) {
        throw new Error(
          `Schema at ${filepath} has illegal $id ${schemaConfig.$id} - schema $id may not start with an underscore`
        );
      }
      const validator = metaSchemas[schemaConfig.type];
      if (!validator) {
        throw new Error(`Schema at ${filepath} has an unsupported type`);
      }
      if (!validator(schemaConfig)) {
        throw new Error(
          `Schema at ${filepath} is invalid: ${JSON.stringify(
            validator.errors
          )}`
        );
      }
      // Only object schemas are used for JSON schema validation
      // Schemas as written have "association" types not recognized by json
      if (isObjectSchemaConfig(schemaConfig)) {
        log.info('This is an object schema, creating JSON schema from it');
        const jsonSchema = produce(schemaConfig, draft => {
          const { properties } = draft;

          delete draft.name;
          delete draft.collectiveName;
          delete draft.description;
          delete draft.files;
          delete draft.icon;
          delete draft.validation;

          if (
            'id' in properties ||
            'shortId' in properties ||
            'name' in properties ||
            'path' in properties ||
            'created' in properties ||
            'modified' in properties
          ) {
            throw new Error(
              `Schema ${filepath} uses reserved properties (id, shortId, name, path, created, or modified)`
            );
          }
          // Set reserved properties.
          // These are all short strings that are stored in database as DataType.STRING (max 255 chars)
          properties.id = {
            type: 'string',
            maxLength: 255,
            // UUIDv4 regex
            pattern:
              '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
            // Needed to use simplified syntax for schema validation, original below
            // '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
          };
          properties.shortId = {
            type: 'string',
            maxLength: 255
          };
          properties.name = { type: 'string', maxLength: 255 };

          Object.keys(draft.properties).forEach(key => {
            const prop = properties[key];
            if (prop.type === 'association') {
              if (!prop.relationship) {
                throw new Error(
                  `Relationship not defined for association ${key} in schema ${filepath}`
                );
              }
              switch (prop.relationship) {
                case 'BelongsTo':
                  properties[key] = {
                    type: 'string',
                    // UUIDv4 regex
                    pattern:
                      '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
                  };
                  break;
                // These relationships affect sequelize configuration but have no YAML serialization
                case 'HasOne':
                case 'HasMany':
                  delete properties[key];
                  break;
                case 'BelongsToMany':
                  properties[key] = {
                    type: 'array',
                    items: {
                      type: 'string',
                      // UUIDv4 regex
                      pattern:
                        '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
                    }
                  };
                  break;
                default:
                  throw new Error(
                    `Unknown relationship ${prop.relationship} for association ${key} in schema ${filepath}`
                  );
              }
            }
            // Ensure nested properties do not contain associations
            if (prop.type === 'array' || prop.type === 'object') {
              if (hasAssociations(prop)) {
                throw new Error(
                  `Nessted associations not allowed in property ${key} in schema ${filepath}`
                );
              }
            }
          });
        });
        log.info('Adding schema', jsonSchema);
        addSchema(jsonSchema); // Throws exception if format is wrong
      }
      // At this point the schema is known to be OK, we can store it
      const schema = getSchema(schemaConfig); // Creates RegExp object and virtualIncludes
      schemas.byId[schemaConfig.$id] = schema;
      log.info(`storing schema under id ${schemaConfig.$id}`);
      schemas.data.push(schema);
    }
  });
  return schemas;
};

const menuSchema = {
  type: 'object',
  properties: {
    home: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        icon: { type: 'string' },
        path: { type: 'string' },
        params: { type: 'object' }
      }
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          icon: { type: 'string' },
          path: { type: 'string' },
          params: { type: 'object' }
        }
      }
    }
  }
};

export const loadAppMenu = (configs: ConfigFileState): AppMenuState => {
  const validator = compileSchema(menuSchema);
  const mainConfigFile = configs.byPath['config.yml'];
  if (!isMainConfigFile(mainConfigFile)) {
    throw new Error('config.yml not available');
  }
  const config = mainConfigFile.content;
  if (!validator(config)) {
    throw new Error(
      `Config.yml contains invalid menu information: ${validator.errors}`
    );
  }
  return {
    home: {
      name: mainConfigFile.content.home.name,
      icon: mainConfigFile.content.home.icon,
      path: mainConfigFile.content.home.path,
      pathWithParams: `${mainConfigFile.content.home.path}/${Buffer.from(
        JSON.stringify(
          mainConfigFile.content.home.params
            ? mainConfigFile.content.home.params
            : {}
        )
      ).toString('base64')}`,
      id: uuidv4()
    },
    categories: mainConfigFile.content.categories.map(category => ({
      name: category.name,
      id: uuidv4(),
      items: category.items.map(item => ({
        name: item.name,
        icon: item.icon,
        path: item.path,
        pathWithParams: `${item.path}/${Buffer.from(
          JSON.stringify(item.params ? item.params : {})
        ).toString('base64')}`,
        id: uuidv4()
      }))
    }))
  };
};

const globalConfigSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    },
    logs: {
      type: 'object',
      properties: {
        console: { type: 'string' },
        file: { type: 'string' },
        ipc: { type: 'string' },
        remote: { type: 'string' }
      }
    }
  }
};

export const loadGlobalConfig = async (): Promise<GlobalConfigFile> => {
  const fullPath = path.join(app.getPath('userData'), GLOBAL_CONFIG_FILE_NAME);
  const contentObj = await loadYamlFile(fullPath, {
    schema: globalConfigSchema
  });
  return {
    type: 'global',
    path: fullPath,
    content: contentObj
  };
};

export const saveGlobalConfig = async (config: GlobalConfig): Promise<void> => {
  const fullPath = path.join(app.getPath('userData'), GLOBAL_CONFIG_FILE_NAME);
  await saveYamlFile(fullPath, config);
};
