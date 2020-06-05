import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { DatabaseState, Dispatch, ConfigFileState, RootState } from './types';
import { initDatabase as doInitDatabase } from '../services/database';
import { Notifier } from './notifications';

interface UpdateDatabaseAction {
  type: 'UPDATE_DATABASE';
}

type DatabaseAction = UpdateDatabaseAction;

export const updateDatabase = (): DatabaseAction => {
  return {
    type: 'UPDATE_DATABASE'
  };
};

export const initDatabase = (
  configs: ConfigFileState,
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    if (Object.keys(configs).length === 0) {
      // initial call with no data
      return;
    }
    try {
      await doInitDatabase(configs);
      dispatch(updateDatabase());
      console.log('Initialized database');
      notify.success(`Database initialized.`);
    } catch (error) {
      console.log('Unable to initialize database', error);
      notify.error(`Unable to initialize database: ${error}`);
    }
  };
};

const reducer = (
  state: DatabaseState = { version: 0 },
  action: DatabaseAction
): DatabaseState => {
  switch (action.type) {
    case 'UPDATE_DATABASE':
      return { version: state.version + 1 };
    default:
      return state;
  }
};

export default reducer;
