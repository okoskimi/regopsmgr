/* eslint-disable no-console */
import React, { Fragment } from 'react';
import { render } from 'react-dom';
import { AppContainer as ReactHotAppContainer } from 'react-hot-loader';

import path from 'path';
import {
  ConfigFileMap,
  configFiles,
  loadSchemas,
  SchemaMap
} from './utils/config';

import Root from './containers/Root';
import { configureStore, history } from './store/configureStore';
import './app.global.css';

const store = configureStore();

const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;

document.addEventListener('DOMContentLoaded', () =>
  render(
    <AppContainer>
      <Root store={store} history={history} />
    </AppContainer>,
    document.getElementById('root')
  )
);

console.log('Starting git part');
configFiles(path.join(process.cwd(), '..', 'branchtest'))
  .then((result: ConfigFileMap) => {
    console.log('Result', result);
    return loadSchemas(result);
  })
  .then((result: SchemaMap) => {
    console.log('Schema:', result);
    return null;
  })
  .catch((error: Error) => {
    console.log('Error', error);
    console.log('Error obj', { error });
  });
console.log('Git part done');
