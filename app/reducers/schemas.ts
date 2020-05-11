import { SchemaMap } from './types';

export type SchemaAction = {
  type: 'SET_SCHEMAS';
  payload: SchemaMap;
};

export function setSchemas(schemas: SchemaMap): SchemaAction {
  return {
    type: 'SET_SCHEMAS',
    payload: schemas
  };
}

const reducer = (state: SchemaMap = {}, action: SchemaAction): SchemaMap => {
  switch (action.type) {
    case 'SET_SCHEMAS':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
