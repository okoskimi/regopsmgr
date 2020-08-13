import React from 'react';
import { Switch, Route } from 'react-router-dom';

import Paths from './constants/paths';

import HomePage from './pages/Home';
import CounterPage from './pages/Counter';
import CounterPage2 from './pages/Counter2';
import Notifications from './pages/Notifications';
import FileTable from './pages/FileTable';
import EditRecord from './pages/EditRecord';
import ViewDocument from './pages/ViewDocument';
import RecordTable from './pages/RecordTable';

function Routes() {
  return (
    <Switch>
      <Route path={Paths.COUNTER_HOME} component={CounterPage} />
      <Route path={Paths.COUNTER_COUNTER} component={CounterPage2} />
      <Route path={Paths.NOTIFICATIONS} component={Notifications} />
      <Route path={Paths.FILE_TABLE} component={FileTable} />
      <Route path={Paths.RECORD_TABLE} component={RecordTable} />
      <Route path={Paths.EDIT_RECORD} component={EditRecord} />
      <Route path={Paths.VIEW_DOCUMENT} component={ViewDocument} />
      <Route path={Paths.HOME} component={HomePage} />
    </Switch>
  );
}

export default Routes;

/*
        <Route path={routes.HOME} component={HomePage} />
*/
