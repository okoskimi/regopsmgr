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

export interface ObjectSchema extends Schema {
  type: 'object';
  properties: {
    [name: string]: {
      type: string;
      [name: string]: string | object | number | boolean;
    };
  };
  validation?: string;
}
export const isObjectSchema = (schema: Schema): schema is ObjectSchema => {
  return schema.type === 'object';
};
export const getSchema = (config: SchemaConfig): Schema => {
  if (isObjectSchemaConfig(config)) {
    const os: ObjectSchema = {
      ...config,
      properties: {
        ...config.properties,
        id: {
          type: 'string',
          maxLength: 255,
          // UUIDv4 regex
          pattern:
            '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i'
        },
        shortId: { type: 'string', maxLength: 255 },
        name: { type: 'string', maxLength: 255 }
      },
      files: new RegExp(config.files)
    };
    return os;
  }
  return { ...config, files: new RegExp(config.files) };
};
