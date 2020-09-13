import elog from 'electron-log';

const log = elog.scope('types/schema');

export interface SchemaBase {
  type: string;
  $id: string;
  name: string;
  collectiveName: string;
  description: string;
  icon: string;
}
export interface SchemaConfig extends SchemaBase {
  files: string;
}
export interface ObjectSchemaConfig extends SchemaConfig {
  type: 'object';
  properties: {
    [name: string]: {
      type: string;
      [name: string]: string | object | number | boolean;
    };
  };
  uiSchema?: any;
  validation?: string;
}
export const isObjectSchemaConfig = (
  schema: SchemaConfig
): schema is ObjectSchemaConfig => {
  return schema.type === 'object';
};
export interface Schema extends SchemaBase {
  files: RegExp;
}
export const defaultSchema: Schema = {
  type: 'default',
  $id: '_default',
  name: 'Schemaless',
  collectiveName: 'Schemaless',
  description: 'Default schema used for files which do not match any schema',
  icon:
    'M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M15.5,8A1.5,1.5 0 0,1 17,9.5A1.5,1.5 0 0,1 15.5,11A1.5,1.5 0 0,1 14,9.5A1.5,1.5 0 0,1 15.5,8M8.5,8A1.5,1.5 0 0,1 10,9.5A1.5,1.5 0 0,1 8.5,11A1.5,1.5 0 0,1 7,9.5A1.5,1.5 0 0,1 8.5,8M12,17.5C9.67,17.5 7.69,16.04 6.89,14H17.11C16.3,16.04 14.33,17.5 12,17.5Z',
  files: /.*/ // Note that this is not actually ever applied, it is specified here strictly for type compatibility
};

export interface DocumentSchema extends Schema {
  type: 'document';
  templating: string;
  format: string;
}

export const isDocumentSchema = (schema: Schema): schema is DocumentSchema => {
  return schema.type === 'document';
};

export interface IncludeEntry {
  model: string; // ModelCtor<Model>;
  as: string;
}

export interface ObjectSchema extends Schema {
  type: 'object';
  properties: {
    [name: string]: {
      type: string;
      [name: string]: string | object | number | boolean;
    };
  };
  uiSchema?: any;
  validation?: string;
  virtualIncludes: Array<IncludeEntry>;
}
export const isObjectSchema = (schema: Schema): schema is ObjectSchema => {
  return schema.type === 'object';
};

export interface AssociationData {
  modelId: string;
  instances: Array<string>;
}

export interface AssociationDataMap {
  [x: string]: AssociationData;
}

export interface DataExtractResult {
  contentObj: any;
  associations: AssociationDataMap;
}
export const extractAssociationsAndVirtualsFromData = (
  schema: ObjectSchema,
  data: any
): DataExtractResult => {
  const contentObj = { ...data };
  const associations: AssociationDataMap = {};
  Object.keys(contentObj).forEach(key => {
    if (schema.properties[key]) {
      const { type, virtual } = schema.properties[key];
      if (type === 'association') {
        const { target } = schema.properties[key];
        if (typeof target === 'string') {
          associations[key] = {
            modelId: target,
            instances: Array.isArray(contentObj[key])
              ? contentObj[key]
              : [contentObj[key]]
          };
        } else {
          throw new Error(
            `Target model for association ${key} in model ${schema.$id} is not a string`
          );
        }
        delete contentObj[key];
      }
      if (virtual) {
        delete contentObj[key];
      }
    } else {
      log.error(
        `Undefined schema property ${key} on schema ${schema.name}`,
        schema
      );
      throw new Error(
        `Undefined schema property ${key} on schema ${schema.name}`
      );
    }
  });
  return {
    contentObj,
    associations
  };
};

export interface AssociationDefinition {
  target: string;
  relationship: string;
  maxItems?: number;
  minItems?: number;
}

export interface SchemaExtractResult {
  contentSchema: ObjectSchema;
  associationNames: Array<string>;
  associationByName: {
    [name: string]: AssociationDefinition;
  };
}

export interface SchemaConfigExtractResult {
  contentSchema: ObjectSchemaConfig;
  associationNames: Array<string>;
  associationByName: {
    [name: string]: AssociationDefinition;
  };
}

type ExtractAssociationFunction = {
  (schema: ObjectSchema): SchemaExtractResult;
  (schema: ObjectSchemaConfig): SchemaConfigExtractResult;
};

export const extractAssociationsAndVirtualsFromSchema: ExtractAssociationFunction = (
  schema: any
): any => {
  const result: any = {
    // Need to create a copy of schema.properties since they get removed
    contentSchema: { ...schema, properties: { ...schema.properties } },
    associationNames: [],
    associationByName: {}
  };
  Object.keys(result.contentSchema.properties).forEach(key => {
    const { type, target, virtual } = result.contentSchema.properties[key];
    if (type === 'association' && typeof target === 'string') {
      result.associationNames.push(key);
      result.associationByName[key] = (result.contentSchema.properties[
        key
      ] as unknown) as AssociationDefinition;
      delete result.contentSchema.properties[key];
    }
    if (virtual) {
      delete result.contentSchema.properties[key];
    }
  });
  return result;
};

export const getNonFilterableFieldsFromSchema = (
  schema: any
): Array<string> => {
  const result: Array<string> = [];
  Object.keys(schema.properties).forEach(key => {
    const { type, virtual } = schema.properties[key];
    if (virtual || type === 'array' || type === 'object') {
      result.push(key);
    }
  });
  return result;
};

export const getSchema = (config: SchemaConfig): Schema => {
  if (isObjectSchemaConfig(config)) {
    const {
      associationNames,
      associationByName
    } = extractAssociationsAndVirtualsFromSchema(config);
    const virtualIncludes: Array<IncludeEntry> = [];
    Object.keys(config.properties).forEach(key => {
      if (config.properties[key].virtual) {
        (config.properties[key].parameters as Array<string>).forEach(param => {
          if (associationNames.includes(param)) {
            virtualIncludes.push({
              model: associationByName[param].target,
              as: param
            });
          }
        });
      }
    });
    log.debug('Adding virtual includes:', virtualIncludes);
    const os: ObjectSchema = {
      ...config,
      properties: {
        ...config.properties,
        id: {
          type: 'string',
          maxLength: 255,
          readOnly: true, // This is just for UI purposes
          // UUIDv4 regex
          pattern:
            '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
        },
        shortId: { type: 'string', maxLength: 255, readOnly: true }, // ReadOnly is just for UI purposes
        name: { type: 'string', maxLength: 255 }
      },
      files: new RegExp(config.files),
      virtualIncludes
    };
    return os;
  }
  return { ...config, files: new RegExp(config.files) };
};
