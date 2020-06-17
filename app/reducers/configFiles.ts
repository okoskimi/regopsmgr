import path from 'path';
import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import elog from 'electron-log';

import { ConfigFileState, Dispatch, RootState } from './types';
import { getConfigFiles } from '../services/config';
import { Notifier } from './notifications';

const log = elog.scope('reducers/configFiles');

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
      log.info('Loading config files');
      const configFiles = await getConfigFiles(
        path.join(process.cwd(), '..', 'branchtest')
      );
      dispatch(setConfigFiles(configFiles));
      log.info('Loaded config files', configFiles);
      notify.success(
        `Loaded ${Object.keys(configFiles).length} configuration files.`
      );
    } catch (error) {
      log.info('Unable to load config files', error);
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
