import path from 'path';
import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import elog from 'electron-log';

import { Dispatch, RootState, ConfigFileState } from '../types/store';
import { getConfigFilesFromGit, loadGlobalConfig } from '../services/config';
import { Notifier } from './notifications';
import { GlobalConfigFile } from '../types/config';

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
      log.info('Loading global config file');
      let globalConfig: GlobalConfigFile | null = null;
      try {
        globalConfig = await loadGlobalConfig();
      } catch (ignore) {
        // ignore
      }
      log.info('Loading git config files');
      const configFiles = await getConfigFilesFromGit(
        path.join(process.cwd(), '..', 'branchtest')
      );
      configFiles.global = globalConfig;
      dispatch(setConfigFiles(configFiles));
      log.info('Loaded config files', configFiles.data, configFiles.global);
      notify.success(
        `Loaded ${Object.keys(configFiles.data).length} configuration files.`
      );
    } catch (error) {
      log.info('Unable to load config files', error);
      notify.error(`Unable to load config files: ${error}`);
    }
  };
};

const reducer = (
  state: ConfigFileState = new ConfigFileState(),
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
