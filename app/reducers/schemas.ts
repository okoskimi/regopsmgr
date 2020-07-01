import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import elog from 'electron-log';

import {
  Dispatch,
  RootState,
  SchemaState,
  ConfigFileState
} from '../types/store';
import { loadSchemas } from '../services/config';
import { Notifier } from './notifications';

const log = elog.scope('reducers/schemas');

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
    if (configs.data.length === 0) {
      // initial call with no data
      return;
    }
    try {
      const schemas = await loadSchemas(configs);
      dispatch(setSchemas(schemas));
      log.info('Loaded schemas', schemas);
      notify.success(`Loaded ${Object.keys(schemas).length} schema entries.`);
    } catch (error) {
      log.info('Unable to load schemas', error);
      notify.error(`Unable to load schemas: ${error}`);
    }
  };
};

const reducer = (
  state: SchemaState = new SchemaState(),
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
