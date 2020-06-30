import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';
import counter from './counter';
import schemas from './schemas';
import database from './database';
import files from './files';
import configFiles from './configFiles';
import notifications from './notifications';
import appMenu from './appMenu';

export default function createRootReducer(history: History) {
  return combineReducers({
    router: connectRouter(history),
    counter,
    schemas,
    database,
    files,
    configFiles,
    notifications,
    appMenu
  });
}
