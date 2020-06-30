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
export interface SchemaState {
  byId: {
    [id: string]: Schema;
  };
  data: Array<Schema>;
}
