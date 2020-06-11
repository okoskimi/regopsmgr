import git, { Walker } from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Ajv from 'ajv';
import { v4 as uuidv4 } from 'uuid';
import produce from 'immer';
import log from 'electron-log';

import {
  ConfigFileState,
  ConfigFile,
  SchemaState,
  AppMenuState,
  isSchemaConfigFile,
  getSchema,
  isString,
  isMainConfigFIle,
  isObjectSchemaConfig
} from '../reducers/types';

// This will be reset in loadSchemas but setting it to null here
// would make null a possible value and force code to null check everywhere
let ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

/*
 * Returns config file contents from <em>master</em> branch.
 */

export const getConfigFiles = async (dir: string): Promise<ConfigFileState> => {
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
                  content: YAML.parse(Buffer.from(binaryData).toString('utf8'))
                };
              } else {
                configFile = {
                  type: 'schema',
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

const commonMetaSchema = ajv.compile({
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
const metaSchemas: { [type: string]: Ajv.ValidateFunction } = {
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
  ajv = new Ajv();
  const schemas: SchemaState = {
    byId: {},
    data: []
  };
  const prefix = `schema${path.sep}`;
  Object.keys(configs).forEach((filepath: string) => {
    const configFile = configs[filepath];
    if (filepath.startsWith(prefix) && isSchemaConfigFile(configFile)) {
      log.info('Validating schema', filepath, configFile);
      const schemaConfig = configFile.content;
      if (!isString(schemaConfig.type)) {
        throw new Error(`Schema at ${filepath} has an invalid type`);
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
            '_data' in properties
          ) {
            throw new Error(
              `Schema ${filepath} uses reserved properties (id, shortId, name or _data)`
            );
          }
          // Set reserved properties.
          // These are all short strings that are stored in database as DataType.STRING (max 255 chars)
          properties.id = {
            type: 'string',
            maxLength: 255,
            // UUIDv4 regex
            pattern:
              '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
          };
          properties.shortId = { type: 'string', maxLength: 255 };
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
                      '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
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
                        '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
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
        ajv.addSchema(jsonSchema); // Throws exception if format is wrong
      }
      // At this point the schema is known to be OK, we can store it
      const schema = getSchema(schemaConfig); // Creates RegExp object
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
        path: { type: 'string' }
      }
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          icon: { type: 'string' },
          path: { type: 'string' }
        }
      }
    }
  }
};

export const loadAppMenu = (configs: ConfigFileState): AppMenuState => {
  const validator = ajv.compile(menuSchema);
  const mainConfigFile = configs['config.yml'];
  if (!isMainConfigFIle(mainConfigFile)) {
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
      id: uuidv4()
    },
    categories: mainConfigFile.content.categories.map(category => ({
      name: category.name,
      id: uuidv4(),
      items: category.items.map(item => ({
        name: item.name,
        icon: item.icon,
        path: item.path,
        id: uuidv4()
      }))
    }))
  };
};

export const validate = (type: string, obj: object) => {
  const success = ajv.validate(type, obj);
  return [success, ajv.errors];
};
