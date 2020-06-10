import {
  Sequelize,
  DataTypes,
  Model,
  ModelAttributes,
  ModelOptions,
  Association
} from 'sequelize';
import log from 'electron-log';
import path from 'path';

import {
  ConfigFileState,
  isSchemaConfigFile,
  Schema,
  getSchema,
  isObjectSchema,
  assertIsDefined
} from '../reducers/types';

export const database = new Sequelize('sqlite::memory:');

type ModelType = typeof Model;

interface AssociationTemplate {
  get?: Function;
  set?: Function;
  count?: Function;
  add?: Function;
  remove?: Function;
  has?: Function;
}

export interface GenericAssociation {
  association: Association;
  get: Function;
  set: Function;
  isMulti: boolean;
}

export interface SingleAssociation extends GenericAssociation {
  isMulti: false;
}

export interface MultiAssociation extends GenericAssociation {
  count: Function;
  add: Function;
  remove: Function;
  has: Function;
  isMulti: true;
}

export const isMultiAssociation = (
  a: GenericAssociation
): a is MultiAssociation => a.isMulti;

export interface ModelWithAssociations extends ModelType {
  associationsByName: {
    [name: string]: GenericAssociation;
  };
}

const addAssociation = (
  schemaName: string,
  property: string,
  association: Association
) => {
  const m = database.models[schemaName] as ModelWithAssociations;
  if (!m.associationsByName) {
    m.associationsByName = {};
  }
  if (['HasOne', 'BelongsTo'].includes(association.associationType)) {
    const initialValue: AssociationTemplate = {};
    const template = Object.getOwnPropertyNames(
      Object.getPrototypeOf(association)
    ).reduce<AssociationTemplate>((obj, key) => {
      const a = association as {
        [key: string]: any;
      };
      if (obj && key.startsWith('get') && typeof a[key] === 'function') {
        return {
          ...obj,
          get: a[key]
        };
      }
      if (obj && key.startsWith('set') && typeof a[key] === 'function') {
        return {
          ...obj,
          set: a[key]
        };
      }
      return obj;
    }, initialValue);
    if (!template.get || !template.set) {
      console.log(
        'Single-association missing accessors',
        'Template:',
        template,
        'Association:',
        association
      );
      throw new Error(
        `Missing accessors for association ${property} in schema ${schemaName}`
      );
    }
    assertIsDefined(template.get);
    assertIsDefined(template.set);
    m.associationsByName[property] = {
      association,
      get: template.get,
      set: template.set,
      isMulti: false
    };
  } else if (
    ['HasMany', 'BelongsToMany'].includes(association.associationType)
  ) {
    const initialValue: AssociationTemplate = {};
    const template = Object.getOwnPropertyNames(
      Object.getPrototypeOf(association)
    ).reduce<typeof initialValue>((obj, key) => {
      const a = association as {
        [key: string]: any;
      };
      if (obj && key.startsWith('get') && typeof a[key] === 'function') {
        return {
          ...obj,
          get: a[key]
        };
      }
      if (obj && key.startsWith('set') && typeof a[key] === 'function') {
        return {
          ...obj,
          set: a[key]
        };
      }
      if (obj && key.startsWith('add') && typeof a[key] === 'function') {
        return {
          ...obj,
          add: a[key]
        };
      }
      if (obj && key.startsWith('remove') && typeof a[key] === 'function') {
        return {
          ...obj,
          remove: a[key]
        };
      }
      if (obj && key.startsWith('count') && typeof a[key] === 'function') {
        return {
          ...obj,
          count: a[key]
        };
      }
      if (obj && key.startsWith('has') && typeof a[key] === 'function') {
        return {
          ...obj,
          has: a[key]
        };
      }
      return obj;
    }, initialValue);
    if (
      !template.get ||
      !template.set ||
      !template.add ||
      !template.remove ||
      !template.count ||
      !template.has
    ) {
      console.log(
        'Multi-association missing accessors',
        'Template:',
        template,
        'Association:',
        association
      );
      throw new Error(
        `Missing accessors for association ${property} in schema ${schemaName}`
      );
    }
    assertIsDefined(template.get);
    assertIsDefined(template.set);
    assertIsDefined(template.add);
    assertIsDefined(template.remove);
    assertIsDefined(template.count);
    assertIsDefined(template.has);
    const a: MultiAssociation = {
      association,
      get: template.get,
      set: template.set,
      add: template.add,
      remove: template.remove,
      count: template.count,
      has: template.has,
      isMulti: true
    };
    m.associationsByName[property] = a;
  } else {
    throw new Error(
      `Unknown association type ${association.associationType} for association ${property} in schema ${schemaName}`
    );
  }
};

const isModelWithAssociations = (
  model: ModelType
): model is ModelWithAssociations => {
  const m = model as ModelWithAssociations;
  return m.associationsByName !== undefined;
};

export const initDatabase = async (configs: ConfigFileState) => {
  const prefix = `schema${path.sep}`;
  const associations: Array<any> = [];
  const schemas: { [id: string]: Schema } = {};
  Object.keys(configs).forEach(filepath => {
    const configFile = configs[filepath];
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
    } // End of if that chooses all schema configuration files
  }); // End of forEach that walks through configuration files
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
    options.foreignKey = {
      name: a.name,
      type: DataTypes.UUIDV4
    };
    switch (a.relationship) {
      case 'HasOne':
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].hasOne(targetModel, options)
        );
        break;
      case 'HasMany':
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].hasMany(targetModel, options)
        );
        break;
      case 'BelongsTo':
        addAssociation(
          a.source,
          a.name,
          database.models[a.source].belongsTo(targetModel, options)
        );
        break;
      case 'BelongsToMany':
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
  await database.sync({ force: true }); // Creates database tables and indexes
};

export const setAssociation = async (
  sourceSchema: Schema,
  sourceInstance: Model,
  property: string,
  target: string | Array<string>
) => {
  const model = database.models[sourceSchema.name];
  if (!isModelWithAssociations(model)) {
    throw new Error(
      `Internal error: associations missing for model for schema ${sourceSchema.name}`
    );
  }
  const association = model.associationsByName[property];
  if (!association) {
    throw new Error(
      `Internal error: association ${property} missing for model for schema ${sourceSchema.name}`
    );
  }
  await association.set(sourceInstance, target);
};
