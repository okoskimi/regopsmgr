import React from 'react';
import { Switch, Route } from 'react-router-dom';
import HomePage from './pages/Home';
import CounterPage from './pages/Counter';
import CounterPage2 from './pages/Counter2';
import Paths from './constants/paths';

function Routes() {
  return (
    <Switch>
      <Route path={Paths.COUNTER_HOME} component={CounterPage} />
      <Route path={Paths.COUNTER_COUNTER} component={CounterPage2} />
      <Route path={Paths.HOME} component={HomePage} />
    </Switch>
  );
}

export default Routes;

/*
        <Route path={routes.HOME} component={HomePage} />
*/
