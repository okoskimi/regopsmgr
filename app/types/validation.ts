import Ajv from 'ajv';

// This will be reset in loadSchemas but setting it to null here
// would make null a possible value and force code to null check everywhere
let ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const resetSchemas = () => {
  ajv = new Ajv();
};

export const compileSchema = (schema: object) => {
  return ajv.compile(schema);
};

export const addSchema = (schema: object) => {
  return ajv.addSchema(schema);
};

export const validateType = (type: string, obj: object) => {
  const success = ajv.validate(type, obj);
  return [success, ajv.errors];
};

export const validateSchema = (schema: object, obj: object) => {
  const validator = ajv.compile(schema);
  const success = validator(obj);
  return [success, ajv.errors];
};
