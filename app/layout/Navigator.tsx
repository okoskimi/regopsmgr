/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable prettier/prettier */
import React, { forwardRef, ReactNode } from 'react';
import clsx from 'clsx';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Drawer, { DrawerProps } from '@material-ui/core/Drawer';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import HomeIcon from '@material-ui/icons/Home';
import PeopleIcon from '@material-ui/icons/People';
import DnsRoundedIcon from '@material-ui/icons/DnsRounded';
import PermMediaOutlinedIcon from '@material-ui/icons/PhotoSizeSelectActual';
import PublicIcon from '@material-ui/icons/Public';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';
import TimerIcon from '@material-ui/icons/Timer';
import SettingsIcon from '@material-ui/icons/Settings';
import PhonelinkSetupIcon from '@material-ui/icons/PhonelinkSetup';
import { Omit } from '@material-ui/types';
import { NavLink } from 'react-router-dom';
import { connect } from 'react-redux';

import Paths from '../constants/paths';

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


const categories = [
  {
    id: 'Develop',
    children: [
      { id: 'Authentication', route: Paths.HOME, icon: <PeopleIcon /> },
      { id: 'Database', route: Paths.COUNTER_HOME, icon: <DnsRoundedIcon /> },
      { id: 'Storage', route: Paths.NOT_SET, icon: <PermMediaOutlinedIcon /> },
      { id: 'Hosting', route: Paths.NOT_SET, icon: <PublicIcon /> },
      { id: 'Functions', route: Paths.NOT_SET, icon: <SettingsEthernetIcon /> },
      { id: 'ML Kit', route: Paths.NOT_SET, icon: <SettingsInputComponentIcon /> },
    ],
  },
  {
    id: 'Quality',
    children: [
      { id: 'Analytics', route: Paths.NOT_SET, icon: <SettingsIcon /> },
      { id: 'Performance', route: Paths.NOT_SET, icon: <TimerIcon /> },
      { id: 'Test Lab', route: Paths.NOT_SET, icon: <PhonelinkSetupIcon /> },
    ],
  },
];

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
    firebase: {
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

export interface NavigatorProps extends Omit<DrawerProps, 'classes'>, WithStyles<typeof styles> {
  pathname: string;
}

function Navigator(props: NavigatorProps) {
  const { classes, pathname, ...other } = props;

  return (
    <Drawer variant="permanent" {...other}>
      <List disablePadding>
        <ListItem className={clsx(classes.firebase, classes.item, classes.itemCategory)}>
          RegOpsMgr
        </ListItem>
        <ListItem className={clsx(classes.item, classes.itemCategory)}>
          <Button
            activeClassName={classes.itemActiveItem}
            className={classes.item}
            component={CustomNavLink}
            to={Paths.HOME}
          >
            <ListItemIcon className={classes.itemIcon}>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText
              classes={{
                primary: classes.itemPrimary,
              }}
            >
              Project Overview
            </ListItemText>
          </Button>
        </ListItem>
        {categories.map(({ id, children }) => (
          <React.Fragment key={id}>
            <ListItem className={classes.categoryHeader}>
              <ListItemText
                classes={{
                  primary: classes.categoryHeaderPrimary,
                }}
              >
                {id}
              </ListItemText>
            </ListItem>
            {children.map(({ id: childId, route, icon }) => {
              console.log ("Active", route === pathname, "Route", route, "Pathname", pathname);
              return (
                <ListItem
                  key={childId}
                  className={classes.item}
                  disableGutters
                >
                  <Button
                    activeClassName={classes.itemActiveItem}
                    className={classes.item}
                    component={CustomNavLink}
                    to={route}
                  >
                    <ListItemIcon className={classes.itemIcon}>{icon}</ListItemIcon>
                    <ListItemText
                      classes={{
                        primary: classes.itemPrimary,
                      }}
                    >
                      {childId}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapStateToProps = (state: any) => ({
  pathname: state.router.location.pathname,
})

export default connect(mapStateToProps)(withStyles(styles)(Navigator));
