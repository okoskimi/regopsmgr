import React from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button } from '@material-ui/core';

import Paths from '../constants/paths';
import styles from './Home.css';
import { useNotification } from '../reducers/notifications';

type OwnProps = {};

const mapState = null;

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

function Home(_props: Props) {
  const notify = useNotification();
  return (
    <div className={styles.container} data-tid="container">
      <h2>Home</h2>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          notify.success('This is a success');
        }}
      >
        Add Success
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          notify.info('This is a info');
        }}
      >
        Add Info
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          notify.warn('This is a warning');
        }}
      >
        Add Warning
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          notify.error('This is an error');
        }}
      >
        Add Error
      </Button>
      <br />
      <hr />
      <Link to={Paths.COUNTER_HOME}>to Counter</Link>
      <br />
      <Link to={Paths.NOTIFICATIONS}>to Notifications</Link>
    </div>
  );
}

export default connector(Home);
