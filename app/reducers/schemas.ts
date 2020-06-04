import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { SchemaState, Dispatch, ConfigFileState, RootState } from './types';
import { loadSchemas } from '../services/config';
import { Notifier } from './notifications';

interface SetSchemaAction {
  type: 'SET_SCHEMAS';
  payload: SchemaState;
}

type SchemaAction = SetSchemaAction;

export const setSchemas = (schemas: SchemaState): SchemaAction => {
  return {
    type: 'SET_SCHEMAS',
    payload: schemas
  };
};

export const initSchemas = (
  configs: ConfigFileState,
  notify: Notifier
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
      notify.success(`Loaded ${Object.keys(schemas).length} schema entries.`);
    } catch (error) {
      console.log('Unable to load schemas', error);
      notify.error(`Unable to load schemas: ${error}`);
    }
  };
};

const reducer = (
  state: SchemaState = { byId: {}, data: [] },
  action: SchemaAction
): SchemaState => {
  switch (action.type) {
    case 'SET_SCHEMAS':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
