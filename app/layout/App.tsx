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
// import Typography from '@material-ui/core/Typography';
// import Link from '@material-ui/core/Link';

import Navigator from './Navigator';
import Content from './Content';
import Header from './Header';
import { RootState } from '../reducers/types';
import { initConfigFiles as _initConfigFiles } from '../reducers/configFiles';
import { initSchemas as _initSchemas } from '../reducers/schemas';
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
  configFiles: state.configFiles
});

const mapDispatch = {
  initConfigFiles: _initConfigFiles,
  initSchemas: _initSchemas,
  initAppMenu: _initAppMenu
};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

function App(props: Props) {
  const { classes, configFiles, initConfigFiles, initSchemas, initAppMenu } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const notify  = useNotification();

  useEffect(() => {
    console.log('calling initConfigFiles');
    initConfigFiles(notify);
  }, []);

  useEffect(() => {
    console.log('Calling initSchemas for', configFiles);
    initSchemas(configFiles, notify);
    console.log('Calling initAppMenu for', configFiles);
    initAppMenu(configFiles, notify);
  }, [configFiles]);

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
