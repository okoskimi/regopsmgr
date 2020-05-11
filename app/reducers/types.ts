import { Dispatch as ReduxDispatch, Store as ReduxStore, Action } from 'redux';

export type ConfigContent = {
  type: string;
  content: Buffer | object;
};

export type ConfigFileMap = {
  [path: string]: ConfigContent;
};

export type SchemaMap = {
  [type: string]: object;
};

export type State = {
  counter: number;
  configFiles: ConfigFileMap;
  schemas: SchemaMap;
};

export type GetState = () => State;

export type Dispatch = ReduxDispatch<Action<string>>;

export type Store = ReduxStore<State, Action<string>>;
