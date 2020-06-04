import path from 'path';
import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { ConfigFileState, Dispatch, RootState } from './types';
import { getConfigFiles } from '../services/config';
import { Notifier } from './notifications';

interface SetConfigAction {
  type: 'SET_CONFIG_FILES';
  payload: ConfigFileState;
}

type ConfigFileAction = SetConfigAction;

export function setConfigFiles(fileMap: ConfigFileState): ConfigFileAction {
  return {
    type: 'SET_CONFIG_FILES',
    payload: fileMap
  };
}

export const initConfigFiles = (
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    try {
      console.log('Loading config files');
      const configFiles = await getConfigFiles(
        path.join(process.cwd(), '..', 'branchtest')
      );
      dispatch(setConfigFiles(configFiles));
      console.log('Loaded config files', configFiles);
      notify.success(
        `Loaded ${Object.keys(configFiles).length} configuration files.`
      );
    } catch (error) {
      console.log('Unable to load config files', error);
      notify.error(`Unable to load config files: ${error}`);
    }
  };
};

const reducer = (
  state: ConfigFileState = {},
  action: ConfigFileAction
): ConfigFileState => {
  switch (action.type) {
    case 'SET_CONFIG_FILES':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
