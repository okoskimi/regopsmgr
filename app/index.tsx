/* eslint-disable no-console */
import React, { Fragment } from 'react';
import { render } from 'react-dom';
import { AppContainer as ReactHotAppContainer } from 'react-hot-loader';

import path from 'path';
import { getConfigFiles, loadSchemas } from './services/config';

import Root from './layout/Root';
import { configureStore, history } from './store/configureStore';
import 'typeface-roboto';
import './app.global.css';
import { ConfigFileMap, SchemaMap } from './reducers/types';

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
getConfigFiles(path.join(process.cwd(), '..', 'branchtest'))
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
