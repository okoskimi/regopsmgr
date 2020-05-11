import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@material-ui/core';

import Paths from '../constants/paths';
import styles from './Home.css';

export default function Home() {
  return (
    <div className={styles.container} data-tid="container">
      <h2>Home</h2>
      <Button variant="contained" color="primary">
        Hello World
      </Button>
      <br />
      <hr />
      <Link to={Paths.COUNTER_HOME}>to Counter</Link>
    </div>
  );
}
