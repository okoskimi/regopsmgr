import { ConfigFileMap } from './types';

export type ConfigFileAction = {
  type: 'SET_CONFIG_FILES';
  payload: ConfigFileMap;
};

export function setConfigFiles(fileMap: ConfigFileMap): ConfigFileAction {
  return {
    type: 'SET_CONFIG_FILES',
    payload: fileMap
  };
}

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
