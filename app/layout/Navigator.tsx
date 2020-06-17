/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable prettier/prettier */
import React, { forwardRef, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { connect, ConnectedProps } from 'react-redux';
import clsx from 'clsx';
import elog from 'electron-log';

import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Drawer, { DrawerProps } from '@material-ui/core/Drawer';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

import { Omit } from '@material-ui/types';
import SvgIcon from '@material-ui/core/SvgIcon';

import { RootState } from '../reducers/types';

const log = elog.scope('layout/Navigator');

type CustomNavProps = {
  children: ReactNode;
  to: string;
  activeClassName: string;
}

const CustomNavLink = forwardRef<HTMLDivElement, CustomNavProps>((props, ref) => (
  <div
    ref={ref}
    style={{ flexGrow: 1 }}
  >
    <NavLink exact {...props} />
  </div>
));
CustomNavLink.displayName = 'CustomNavLink';

const styles = (theme: Theme) =>
  createStyles({
    categoryHeader: {
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    },
    categoryHeaderPrimary: {
      color: theme.palette.common.white,
    },
    item: {
      paddingTop: 1,
      paddingBottom: 1,
      borderRadius: 0,
      width: '100%',
      color: 'rgba(255, 255, 255, 0.7)',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      },
      /* '&:hover,&:focus': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      }, */
    },
    itemCategory: {
      backgroundColor: '#232f3e',
      boxShadow: '0 -1px 0 #404854 inset',
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    },
    app: {
      fontSize: 24,
      color: theme.palette.common.white,
    },
    itemActiveItem: {
      color: '#4fc3f7',
    },
    itemPrimary: {
      fontSize: 'inherit',
    },
    itemIcon: {
      minWidth: 'auto',
      marginRight: theme.spacing(2),
    },
    divider: {
      marginTop: theme.spacing(2),
    },
  });

type OwnProps = Omit<DrawerProps, 'classes'> & WithStyles<typeof styles>;

const mapState = (state: RootState) => ({
  pathname: state.router.location.pathname,
  appMenu: state.appMenu
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

function Navigator(props: Props) {
  const { classes, pathname, appMenu, ...other } = props;

  return (
    <Drawer variant="permanent" {...other}>
      <List disablePadding>
        <ListItem className={clsx(classes.app, classes.item, classes.itemCategory)}>
          RegOpsMgr
        </ListItem>
        <ListItem
          className={clsx(classes.item, classes.itemCategory)}
          disableGutters
        >
          <Button
            activeClassName={classes.itemActiveItem}
            className={classes.item}
            component={CustomNavLink}
            to={appMenu.home.path}
          >
            <ListItemIcon className={classes.itemIcon}>
              <SvgIcon>
                <path d={appMenu.home.icon} />
              </SvgIcon>
            </ListItemIcon>
            <ListItemText
              classes={{
                primary: classes.itemPrimary,
              }}
            >
              {appMenu.home.name}
            </ListItemText>
          </Button>
        </ListItem>
        {appMenu.categories.map(category => (
          <React.Fragment key={category.id}>
            <ListItem className={classes.categoryHeader}>
              <ListItemText
                classes={{
                  primary: classes.categoryHeaderPrimary,
                }}
              >
                { category.name }
              </ListItemText>
            </ListItem>
            {category.items.map(item => {
              log.debug ("Active", item.path === pathname, "Item path", item.path, "Pathname", pathname);
              return (
                <ListItem
                  key={item.id}
                  className={classes.item}
                  disableGutters
                >
                  <Button
                    activeClassName={classes.itemActiveItem}
                    className={classes.item}
                    component={CustomNavLink}
                    to={item.path}
                  >
                    <ListItemIcon className={classes.itemIcon}>
                      <SvgIcon>
                        <path d={item.icon} />
                      </SvgIcon>
                    </ListItemIcon>
                    <ListItemText
                      classes={{
                        primary: classes.itemPrimary,
                      }}
                    >
                      {item.name}
                    </ListItemText>
                  </Button>
                </ListItem>
            )})}
            <Divider className={classes.divider} />
          </React.Fragment>
        ))}
      </List>
    </Drawer>
  );
}

export default connector(withStyles(styles)(Navigator));
