/* eslint-disable prettier/prettier */
/* eslint-disable react/jsx-curly-brace-presence */
/* eslint-disable react/jsx-one-expression-per-line */
import React from 'react';
import { Provider, connect, ConnectedProps } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import { hot } from 'react-hot-loader/root';
import { History } from 'history';
import { SnackbarProvider } from 'notistack';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { Button } from '@material-ui/core';


import { Store } from '../reducers/types';
import { markNotificationAsSeen as _markNotificationAsSeen } from '../reducers/notifications';

import App from './App';

let theme = createMuiTheme({
  palette: {
    primary: {
      light: '#63ccff',
      main: '#009be5',
      dark: '#006db3',
    },
  },
  typography: {
    h5: {
      fontWeight: 500,
      fontSize: 26,
      letterSpacing: 0.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  props: {
    MuiTab: {
      disableRipple: true,
    },
  },
  mixins: {
    toolbar: {
      minHeight: 48,
    },
  },
});

theme = {
  ...theme,
  overrides: {
    MuiDrawer: {
      paper: {
        backgroundColor: '#18202c',
      },
    },
    MuiButton: {
      label: {
        textTransform: 'none',
      },
      contained: {
        boxShadow: 'none',
        '&:active': {
          boxShadow: 'none',
        },
      },
    },
    MuiTabs: {
      root: {
        marginLeft: theme.spacing(1),
      },
      indicator: {
        height: 3,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        backgroundColor: theme.palette.common.white,
      },
    },
    MuiTab: {
      root: {
        textTransform: 'none',
        margin: '0 16px',
        minWidth: 0,
        padding: 0,
        [theme.breakpoints.up('md')]: {
          padding: 0,
          minWidth: 0,
        },
      },
    },
    MuiIconButton: {
      root: {
        padding: theme.spacing(1),
      },
    },
    MuiTooltip: {
      tooltip: {
        borderRadius: 4,
      },
    },
    MuiDivider: {
      root: {
        backgroundColor: '#404854',
      },
    },
    MuiListItemText: {
      primary: {
        fontWeight: theme.typography.fontWeightMedium,
      },
    },
    MuiListItemIcon: {
      root: {
        color: 'inherit',
        marginRight: 0,
        '& svg': {
          fontSize: 20,
        },
      },
    },
    MuiAvatar: {
      root: {
        width: 32,
        height: 32,
      },
    },
  },
};

// add action to all snackbars
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notistackRef: any = React.createRef();
const onClickDismiss = (key: string, markNotificationAsSeen: typeof _markNotificationAsSeen) => () => {
  if (notistackRef !== null && notistackRef.current) {
    notistackRef.current.closeSnackbar(key);
    markNotificationAsSeen(key);
  }
}

type OwnProps = {
  store: Store;
  history: History;
};

const mapState = null;

const mapDispatch = {
  markNotificationAsSeen: _markNotificationAsSeen
};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;


const Root = (props: Props) => {
  const { store, history, markNotificationAsSeen } = props;
  return (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <ThemeProvider theme={theme}>
          <SnackbarProvider
            maxSnack={8}
            ref={notistackRef}
            action={(key: string) => (
              <Button onClick={onClickDismiss(key, markNotificationAsSeen)}>
                  Dismiss
              </Button>
              )}
          >
            <App />
          </SnackbarProvider>
        </ThemeProvider>
      </ConnectedRouter>
    </Provider>
  );
};

export default hot(connector(Root));
