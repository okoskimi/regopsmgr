import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { SchemaMap, Dispatch, ConfigFileMap, RootState } from './types';
import { loadSchemas } from '../services/config';

interface SetSchemaAction {
  type: 'SET_SCHEMAS';
  payload: SchemaMap;
}

type SchemaAction = SetSchemaAction;

export const setSchemas = (schemas: SchemaMap): SchemaAction => {
  return {
    type: 'SET_SCHEMAS',
    payload: schemas
  };
};

export const initSchemas = (
  configs: ConfigFileMap,
  enqueueSnackbar: Function
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    if (Object.keys(configs).length === 0) {
      // initial call with no data
      return;
    }
    try {
      const schemas = await loadSchemas(configs);
      dispatch(setSchemas(schemas));
      console.log('Loaded schemas', schemas);
      enqueueSnackbar(`Loaded ${Object.keys(schemas).length} schema entries.`, {
        variant: 'success'
      });
    } catch (error) {
      console.log('Unable to load schemas', error);
      enqueueSnackbar(`Unable to load schemas: ${error}`, {
        variant: 'error'
      });
    }
  };
};

const reducer = (
  state: SchemaMap = { byExtension: {}, byName: {} },
  action: SchemaAction
): SchemaMap => {
  switch (action.type) {
    case 'SET_SCHEMAS':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
