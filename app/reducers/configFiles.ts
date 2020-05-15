import path from 'path';
import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { ConfigFileMap, Dispatch, RootState } from './types';
import { getConfigFiles } from '../services/config';

interface SetConfigAction {
  type: 'SET_CONFIG_FILES';
  payload: ConfigFileMap;
}

type ConfigFileAction = SetConfigAction;

export function setConfigFiles(fileMap: ConfigFileMap): ConfigFileAction {
  return {
    type: 'SET_CONFIG_FILES',
    payload: fileMap
  };
}

export const initConfigFiles = (
  enqueueSnackbar: Function
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    try {
      console.log('Loading config files');
      const configFiles = await getConfigFiles(
        path.join(process.cwd(), '..', 'branchtest')
      );
      dispatch(setConfigFiles(configFiles));
      console.log('Loaded config files', configFiles);
      enqueueSnackbar(
        `Loaded ${Object.keys(configFiles).length} configuration files.`,
        {
          variant: 'success'
        }
      );
    } catch (error) {
      console.log('Unable to load config files', error);
      enqueueSnackbar(`Unable to load config files: ${error}`, {
        variant: 'error'
      });
    }
  };
};

const reducer = (
  state: ConfigFileMap = {},
  action: ConfigFileAction
): ConfigFileMap => {
  switch (action.type) {
    case 'SET_CONFIG_FILES':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
