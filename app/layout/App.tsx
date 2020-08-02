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
import elog, { LevelOption } from 'electron-log';

// import Typography from '@material-ui/core/Typography';
// import Link from '@material-ui/core/Link';

import Navigator from './Navigator';
import Content from './Content';
import Header from './Header';
import { RootState } from '../types/store';
import { initConfigFiles as _initConfigFiles } from '../reducers/configFiles';
import { initSchemas as _initSchemas } from '../reducers/schemas';
import { initDatabase as _initDatabase, loadFilesToDatabase as _loadFilesToDatabase } from '../reducers/database';
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
  loadFilesToDatabase: _loadFilesToDatabase
};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

const isLevelOption = (option: string | boolean): option is LevelOption => {
  if (typeof option === 'string') {
    return ['silly', 'verbose', 'debug', 'info', 'warn', 'error'].includes(
      option
    );
  }
  return option === false;
};

function App(props: Props) {
  const { classes, configFiles, schemas, database, initConfigFiles, initSchemas, initAppMenu, initDatabase, loadFilesToDatabase } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [configsLoaded, setConfigsLoaded] = React.useState(false);
  const notify  = useNotification();

  useEffect(() => {
    log.info('calling initConfigFiles');
    if (!configsLoaded) {
      initConfigFiles(notify);
      if (configFiles.global) {
        elog.transports.console.level =
          process.env.NODE_ENV === 'development' ? 'info' : 'warn';
        elog.transports.file.level =
          process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'
            ? 'debug'
            : 'info';
        if (elog.transports.ipc) {
          elog.transports.ipc.level = false;
        }
        if (elog.transports.remote) {
          elog.transports.remote.level = false;
        }
        try {
          if (isLevelOption(configFiles.global.content.log.console)) {
            elog.transports.console.level = configFiles.global.content.log.console;
          }
          if (isLevelOption(configFiles.global.content.log.file)) {
            elog.transports.file.level = configFiles.global.content.log.file;
          }
          if (isLevelOption(configFiles.global.content.log.ipc) && elog.transports.ipc) {
            elog.transports.ipc.level = configFiles.global.content.log.ipc;
          }
          if (isLevelOption(configFiles.global.content.log.remote) && elog.transports.remote) {
            elog.transports.remote.level = configFiles.global.content.log.remote;
          }
        } catch (ignore) {
          // ignore
        }

        console.log(`Logging to console at level: ${elog.transports.console.level}`);
        console.log(
          `Logging to ${elog.transports.file.getFile().path} at level: ${
            elog.transports.file.level
          }`
        );
      }
      setConfigsLoaded(true);
    }
  }, [configsLoaded]);

  useEffect(() => {
    // log.info('Calling initSchemas for', configFiles);
    initSchemas(configFiles, notify);
    // log.info('Calling initAppMenu for', configFiles);
    initAppMenu(configFiles, notify);
    // log.info('Calling initDatabase for', configFiles);
    initDatabase(configFiles, notify);

  }, [configFiles]);

  useEffect(() => {
    log.info('Calling loadFilesToDatabase');
    loadFilesToDatabase(database, schemas, notify);
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
