import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { Dispatch, ConfigFileState, RootState, AppMenuState } from './types';
import { loadAppMenu } from '../services/config';
import { Notifier } from './notifications';

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
    if (Object.keys(configs).length === 0) {
      // initial call with no data
      return;
    }
    try {
      const appMenu = await loadAppMenu(configs);
      dispatch(setAppMenu(appMenu));
      console.log('Loaded menu', appMenu);
      notify.success(`Loaded ${appMenu.categories.length} category entries.`);
    } catch (error) {
      console.log('Unable to load menu', error);
      notify.error(`Unable to load menu: ${error}`);
    }
  };
};

const reducer = (
  state: AppMenuState = {
    home: {
      name: 'Dashboard',
      icon: '',
      path: '/',
      id: '1'
    },
    categories: []
  },
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
