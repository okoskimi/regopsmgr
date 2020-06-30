/* eslint-disable prettier/prettier */
/* eslint-disable react/jsx-curly-brace-presence */
/* eslint-disable react/jsx-one-expression-per-line */
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import {
  createStyles,
  withStyles,
  WithStyles,
  Theme,
} from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import Hidden from '@material-ui/core/Hidden';
import { enableAllPlugins } from 'immer';
import elog from 'electron-log';

// import Typography from '@material-ui/core/Typography';
// import Link from '@material-ui/core/Link';

import Navigator from './Navigator';
import Content from './Content';
import Header from './Header';
import { RootState } from '../types/store';
import { initConfigFiles as _initConfigFiles } from '../reducers/configFiles';
import { initSchemas as _initSchemas } from '../reducers/schemas';
import { initDatabase as _initDatabase } from '../reducers/database';
import { initFiles as _initFiles } from '../reducers/files';
import { initAppMenu as _initAppMenu } from '../reducers/appMenu';
import { useNotification } from '../reducers/notifications';
import { drawerWidth } from '../constants/layout'
/*
function Copyright() {
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="https://material-ui.com/">
        Oskari Koskimies
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}
*/

enableAllPlugins();

const logLevel = 'info';
elog.transports.console.level = logLevel;
elog.transports.file.level = logLevel;
if (elog.transports.ipc) {
  elog.transports.ipc.level = logLevel;
}
if (elog.transports.remote) {
  elog.transports.remote.level = logLevel;
}

const log = elog.scope('layout/App');

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    /* minHeight: '100vh', */
    height: '100vh',
    overflow: 'hidden'
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  app: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%'
  },
  main: {
    flex: 1,
    display: 'flex',
    /* padding: theme.spacing(6, 4), */
    background: '#eaeff1',
    overflow: 'hidden',
    height: '100%'
  },
  /*
  footer: {
    padding: theme.spacing(2),
    background: '#eaeff1',
  },
  */
});

type OwnProps = WithStyles<typeof styles>;

const mapState = (state: RootState) => ({
  configFiles: state.configFiles,
  schemas: state.schemas,
  database: state.database
});

const mapDispatch = {
  initConfigFiles: _initConfigFiles,
  initSchemas: _initSchemas,
  initAppMenu: _initAppMenu,
  initDatabase: _initDatabase,
  initFiles: _initFiles
};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

function App(props: Props) {
  const { classes, configFiles, schemas, database, initConfigFiles, initSchemas, initAppMenu, initDatabase, initFiles } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const notify  = useNotification();

  useEffect(() => {
    log.info('calling initConfigFiles');
    initConfigFiles(notify);
  }, []);

  useEffect(() => {
    log.info('Calling initSchemas for', configFiles);
    initSchemas(configFiles, notify);
    log.info('Calling initAppMenu for', configFiles);
    initAppMenu(configFiles, notify);
    log.info('Calling initDatabase for', configFiles);
    initDatabase(configFiles, notify);

  }, [configFiles]);

  useEffect(() => {
    log.info('Calling initFiles');
    initFiles(database, schemas, notify);
  }, [database, schemas]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <div className={classes.root}>
      <CssBaseline />
      <nav className={classes.drawer}>
        <Hidden smUp implementation="js">
          <Navigator
            PaperProps={{ style: { width: drawerWidth } }}
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
          />
        </Hidden>
        <Hidden xsDown implementation="css">
          <Navigator PaperProps={{ style: { width: drawerWidth } }} />
        </Hidden>
      </nav>
      <div className={classes.app}>
        <Header onDrawerToggle={handleDrawerToggle} />
        <div className={classes.main}>
          <Content />
        </div>
      </div>
    </div>
  );
}

export default connector(withStyles(styles)(App));

/*

  return (
    <div className={classes.root}>
      <CssBaseline />
      <nav className={classes.drawer}>
        <Hidden smUp implementation="js">
          <Navigator
            PaperProps={{ style: { width: drawerWidth } }}
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
          />
        </Hidden>
        <Hidden xsDown implementation="css">
          <Navigator PaperProps={{ style: { width: drawerWidth } }} />
        </Hidden>
      </nav>
      <div className={classes.app}>
        <Header onDrawerToggle={handleDrawerToggle} />
        <main className={classes.main}>
          <Content />
        </main>
        <footer className={classes.footer}>
          <Copyright />
        </footer>
      </div>
    </div>
  );
}
*/
