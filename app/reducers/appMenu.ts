import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';
import elog from 'electron-log';

import {
  Dispatch,
  RootState,
  AppMenuState,
  ConfigFileState
} from '../types/store';
import { loadAppMenu } from '../services/config';
import { Notifier } from './notifications';

const log = elog.scope('reducers/appMenu');

interface SetAppMenuAction {
  type: 'SET_APPMENU';
  payload: AppMenuState;
}

type AppMenuAction = SetAppMenuAction;

export const setAppMenu = (appMenu: AppMenuState): AppMenuAction => {
  return {
    type: 'SET_APPMENU',
    payload: appMenu
  };
};

export const initAppMenu = (
  configs: ConfigFileState,
  notify: Notifier
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    if (configs.data.length === 0) {
      // initial call with no data
      return;
    }
    try {
      const appMenu = await loadAppMenu(configs);
      dispatch(setAppMenu(appMenu));
      log.info('Loaded menu', appMenu);
      notify.success(`Loaded ${appMenu.categories.length} category entries.`);
    } catch (error) {
      log.info('Unable to load menu', error);
      notify.error(`Unable to load menu: ${error}`);
    }
  };
};

const reducer = (
  state: AppMenuState = new AppMenuState(),
  action: AppMenuAction
): AppMenuState => {
  switch (action.type) {
    case 'SET_APPMENU':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
