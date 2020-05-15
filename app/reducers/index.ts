import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';
import counter from './counter';
import schemas from './schemas';
import configFiles from './configFiles';
import notifications from './notifications';
import categories from './categories';

export default function createRootReducer(history: History) {
  return combineReducers({
    router: connectRouter(history),
    counter,
    schemas,
    configFiles,
    notifications,
    categories
  });
}
