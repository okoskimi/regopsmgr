import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { Dispatch, ConfigFileMap, RootState, Category } from './types';
import { loadCategories } from '../services/config';

interface SetCategoriesAction {
  type: 'SET_CATEGORIES';
  payload: Array<Category>;
}

type CategoryAction = SetCategoriesAction;

export const setCategories = (categories: Array<Category>): CategoryAction => {
  return {
    type: 'SET_CATEGORIES',
    payload: categories
  };
};

export const initCategories = (
  configs: ConfigFileMap,
  enqueueSnackbar: Function
): ThunkAction<void, RootState, unknown, Action<string>> => {
  return async (dispatch: Dispatch) => {
    if (Object.keys(configs).length === 0) {
      // initial call with no data
      return;
    }
    try {
      const categories = await loadCategories(configs);
      dispatch(setCategories(categories));
      console.log('Loaded categories', categories);
      enqueueSnackbar(`Loaded ${categories.length} category entries.`, {
        variant: 'success'
      });
    } catch (error) {
      console.log('Unable to load categories', error);
      enqueueSnackbar(`Unable to load categories: ${error}`, {
        variant: 'error'
      });
    }
  };
};

const reducer = (
  state: Array<Category> = [],
  action: CategoryAction
): Array<Category> => {
  switch (action.type) {
    case 'SET_CATEGORIES':
      return action.payload;
    default:
      return state;
  }
};

export default reducer;
