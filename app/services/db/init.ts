import { DataTypes, ModelAttributes, ModelOptions } from 'sequelize';
import elog from 'electron-log';
import path from 'path';

import { assertIsDefined } from '../../types/util';
import { Schema, getSchema, isObjectSchema } from '../../types/schema';
import { isSchemaConfigFile } from '../../types/config';
import { ConfigFileState } from '../../types/store';
import { FILE_MODEL_ID, DIR_MODEL_ID } from '../../constants/database';
import { database } from '.';
import { addAssociation } from './model';

const log = elog.scope('services/db/init');

// Set SQLite specific collation hack
const COLLATED_STRING = `${DataTypes.STRING} COLLATE NOCASE`;
const COLLATED_TEXT = `${DataTypes.TEXT} COLLATE NOCASE`;

const fileModel = {
  path: {
    type: COLLATED_TEXT,
    primaryKey: true
  },
  id: COLLATED_STRING,
  shortId: COLLATED_STRING,
  name: COLLATED_STRING,
  description: COLLATED_TEXT,
  content: DataTypes.JSON,
  created: DataTypes.DATE,
  modified: DataTypes.DATE,
  uncommittedChanges: DataTypes.BOOLEAN,
  schemaId: COLLATED_STRING
};

const dirModel = {
  path: {
    type: COLLATED_TEXT,
    primaryKey: true
  }
};

export const initDatabase = async (configs: ConfigFileState) => {
  const prefix = `schema${path.sep}`;
  const associations: Array<any> = [];
  const schemas: { [id: string]: Schema } = {};
  configs.data.forEach(configFile => {
    const filepath = configFile.path;
    if (filepath.startsWith(prefix) && isSchemaConfigFile(configFile)) {
      log.info('Creating database model for', filepath);
      const schema = getSchema(configFile.content);
      if (isObjectSchema(schema)) {
        schemas[schema.$id] = schema;
        const model: ModelAttributes = {
          id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
          },
          _data: {
            type: DataTypes.JSON,
            allowNull: false
          },
          shortId: COLLATED_STRING,
          name: COLLATED_STRING,
          created: DataTypes.DATE,
          modified: DataTypes.DATE
        };
        const modelOptions: ModelOptions = {
          // Do not autocreate timestamps because they come from git
          timestamps: false,
          // Note that sqlite creates automatically index for primary key (id)
          indexes: [
            {
              fields: ['shortId']
            },
            {
              fields: ['name']
            },
            {
              fields: ['modified']
            }
          ]
        };
        Object.keys(schema.properties).forEach(key => {
          if (key === 'id') {
            return; // This was already added in model initialization
          }
          const prop = schema.properties[key];
          assertIsDefined(modelOptions.indexes);
          switch (prop.type) {
            case 'string':
              // Enumeration values are assumed to be short strings (max 255 characters).
              if ('enum' in prop) {
                model[key] = COLLATED_STRING;
              } else {
                model[key] = COLLATED_TEXT;
              }
              if (prop.index === true) {
                modelOptions.indexes.push({
                  fields: [key]
                });
              }
              break;
            case 'integer':
              model[key] = DataTypes.INTEGER;
              if (prop.index === true) {
                modelOptions.indexes.push({
                  fields: [key]
                });
              }
              break;
            case 'number':
              model[key] = DataTypes.DOUBLE;
              if (prop.index === true) {
                modelOptions.indexes.push({
                  fields: [key]
                });
              }
              break;
            case 'boolean':
              model[key] = DataTypes.BOOLEAN;
              if (prop.index === true) {
                modelOptions.indexes.push({
                  fields: [key]
                });
              }
              break;
            case 'association':
              if (!prop.target) {
                throw new Error(
                  `Target not defined for association ${key} in ${filepath}`
                );
              }
              if (!prop.relationship) {
                throw new Error(
                  `Relationship not defined for association ${key} in ${filepath}`
                );
              }
              if (prop.relationship === 'BelongsToMany' && !prop.through) {
                throw new Error(
                  `Through not defined for BelongsToMany association ${key} in ${filepath}`
                );
              }
              if (prop.index === true) {
                throw new Error(
                  `Indexes are not supported for associations (${key} in ${filepath})`
                );
              }
              associations.push({
                ...prop,
                filepath,
                name: key,
                source: schema.$id
              });
              break;
            case 'object':
              // No effect on the model
              if (prop.index === true) {
                throw new Error(
                  `Indexes are not supported for objects (${key} in ${filepath})`
                );
              }
              break;
            case 'array':
              // No effect on the model
              if (prop.index === true) {
                throw new Error(
                  `Indexes are not supported for objects (${key} in ${filepath})`
                );
              }
              break;
            default:
              throw new Error(`Unknown property type ${prop.type}`);
          }
        }); // End of forEach that walks through properties
        database.define(schema.$id, model, modelOptions);
      } // End of if that chooses all object schemas
    } // End of if that chooses all schema configuration files
  }); // End of forEach that walks through configuration files
  associations.forEach(a => {
    if (!schemas[a.target]) {
      throw new Error(
        `Target model with schema $id ${a.target} for relationship ${a.name} in ${a.filepath} not found`
      );
    }
    const targetModel = database.models[schemas[a.target].$id];
    if (!targetModel) {
      throw new Error(
        `Target model with schema $id ${
          schemas[a.target].$id
        } for relationship ${a.name} in ${a.filepath} does not exist`
      );
    }
    log.info('Target model', targetModel.name);
    // Schema properties for association that are not known properties (which are removed below)
    // are used as options for creating the association
    const options = { ...a }; // Shallow copy
    // Deleting properties from shallow copy does not affect original copy
    delete options.source;
    delete options.target;
    delete options.filepath;
    delete options.name;
    delete options.relationship;
    delete options.type;
    delete options.filter;
    // Temp:
    if (options.as) {
      delete options.as;
    }
    // Prevent constraint errors when target instances do not exist yet.
    options.constraints = false;
    /*
    options.foreignKey = {
      name: a.name,
      type: DataTypes.UUIDV4
    };
    */
    switch (a.relationship) {
      case 'HasOne':
        log.debug(
          `Adding HasOne association ${a.source} --${a.name}--> ${targetModel.name} with options:`,
          options
        );
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].hasOne(targetModel, options)
        );
        break;
      case 'HasMany':
        /*
        log.debug(
          `Adding HasMany association ${a.source} --${a.name}--> ${targetModel.name} with options:`,
          options
        );
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].hasMany(targetModel, options)
        );
        */
        break;
      case 'BelongsTo':
        // options.foreignKey = a.name;
        log.debug(
          `Adding BelongsTo association ${a.source} --${a.name}--> ${targetModel.name} with options:`,
          options
        );
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].belongsTo(targetModel, options)
        );
        break;
      case 'BelongsToMany':
        // options.foreignKey = a.name;
        log.debug(
          `Adding BelongsToMany association ${a.source} --${a.name}--> ${targetModel.name} with options:`,
          options
        );
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].belongsToMany(targetModel, options)
        );
        break;
      default:
        throw new Error(
          `Unknown relationship ${a.relationship} in ${a.filepath}`
        );
    }
  }); // End of forEach that walks through associations
  // Define file model
  const FileModel = database.define(FILE_MODEL_ID, fileModel, {
    timestamps: false
  });
  const DirModel = database.define(DIR_MODEL_ID, dirModel, {
    timestamps: false
  });
  // Set foreign key to make sure we can manually set the references
  FileModel.belongsTo(DirModel, { as: 'dir', foreignKey: 'dirId' });
  DirModel.hasMany(FileModel, { as: 'files' });

  await database.sync({ force: true }); // Creates database tables and indexes
};

export default {};
