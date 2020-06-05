import { Sequelize, DataTypes, ModelAttributes, ModelOptions } from 'sequelize';
import log from 'electron-log';
import path from 'path';

import {
  ConfigFileState,
  isSchema,
  Schema,
  isObjectSchema,
  assertIsDefined
} from '../reducers/types';

export const database = new Sequelize('sqlite::memory:');

export const initDatabase = async (configs: ConfigFileState) => {
  const prefix = `schema${path.sep}`;
  const associations: Array<any> = [];
  const schemas: { [id: string]: Schema } = {};
  Object.keys(configs).forEach(filepath => {
    const configFile = configs[filepath];
    if (
      filepath.startsWith(prefix) &&
      isSchema(configFile) &&
      isObjectSchema(configFile.content)
    ) {
      log.info('Creating database model for', filepath);
      const schema = configFile.content;
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
        shortId: DataTypes.STRING,
        name: DataTypes.STRING
      };
      const modelOptions: ModelOptions = {
        // Note that sqlite creates automatically index for primary key (id)
        indexes: [
          {
            fields: ['shortId']
          },
          {
            fields: ['name']
          }
        ]
      };
      Object.keys(schema.properties).forEach(key => {
        const prop = schema.properties[key];
        assertIsDefined(modelOptions.indexes);
        switch (prop.type) {
          case 'string':
            // Enumeration values are assumed to be short strings (max 255 characters).
            if ('enum' in prop) {
              model[key] = DataTypes.STRING;
            } else {
              model[key] = DataTypes.TEXT;
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
            if (prop.relationship === 'belongsToMany' && !prop.through) {
              throw new Error(
                `Through not defined for belongsToMany association ${key} in ${filepath}`
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
              source: schema.name
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
      database.define(schema.name, model, modelOptions);
    } // End of if that chooses all object schemas
  }); // End of forEach that walks through schemas
  associations.forEach(a => {
    if (!schemas[a.target]) {
      throw new Error(
        `Target model with schema $id ${a.target} for relationship ${a.name} in ${a.filepath} not found`
      );
    }
    const targetModel = database.models[schemas[a.target].name];
    console.log('Target model', targetModel);
    if (!targetModel) {
      throw new Error(
        `Target model with schema name ${
          schemas[a.target].name
        } for relationship ${a.name} in ${a.filepath} does not exist`
      );
    }
    const options = { ...a }; // Shallow copy
    // Deleting properties from shallow copy does not affect original copy
    delete options.source;
    delete options.target;
    delete options.filepath;
    delete options.name;
    delete options.relationship;
    delete options.type;
    delete options.filter;
    switch (a.relationship) {
      case 'hasOne':
        database.models[a.source].hasOne(targetModel, options);
        break;
      case 'hasMany':
        database.models[a.source].hasMany(targetModel, options);
        break;
      case 'belongsTo':
        database.models[a.source].belongsTo(targetModel, options);
        break;
      case 'belongsToMany':
        database.models[a.source].belongsToMany(targetModel, options);
        break;
      default:
        throw new Error(
          `Unknown relationship ${a.relationship} in ${a.filepath}`
        );
    }
  }); // End of forEach that walks through associations
  await database.sync({ force: true }); // Creates database tables and indexes
};

// export default { database };
