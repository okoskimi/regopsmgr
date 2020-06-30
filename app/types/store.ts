import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';
import { RouterState } from 'connected-react-router';
import { ConfigFileState } from './config';
import { SchemaState } from './schema';
import { AppMenuState, NotificationState } from './app';
import { DatabaseState } from './database';
import { FileState } from './file';

export interface RootState {
  router: RouterState;
  counter: number;
  configFiles: ConfigFileState;
  schemas: SchemaState;
  appMenu: AppMenuState;
  notifications: NotificationState;
  database: DatabaseState;
  files: FileState;
}

export type GetState = () => RootState;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<RootState, Action<string>>;
