/* eslint-disable prettier/prettier */
import React from 'react';
// import Paper from '@material-ui/core/Paper';
// import Drawer from '@material-ui/core/Drawer';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
// import Grid from '@material-ui/core/Grid';

import Routes from '../Routes';

const styles = (_theme: Theme) =>
  createStyles({
    content: {
      width: '100%',
      overflowY: 'auto',
      height: '100%',
      backgroundColor: 'white',
    },
    /*
    paper: {
      maxWidth: 936,
      margin: 'auto',
      overflow: 'scroll'
    },
    searchBar: {
      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
    },
    searchInput: {
      fontSize: theme.typography.fontSize,
    },
    block: {
      display: 'block',
    },
    addUser: {
      marginRight: theme.spacing(1),
    },
    contentWrapper: {
      margin: '20px 16px',
    },
    */
  });

export type Props = WithStyles<typeof styles>

function Content(props: Props) {
  const { classes } = props;

  return (
    <div className={classes.content}>
      <Routes />
    </div>
  );


/*
  return (
    <Paper className={classes.paper}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <Routes />
        </Grid>
      </Grid>
    </Paper>
  );
  */
}

export default withStyles(styles)(Content);

/*

import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';


    <Paper className={classes.paper}>
      <AppBar className={classes.searchBar} position="static" color="default" elevation={0}>
        <Toolbar>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <SearchIcon className={classes.block} color="inherit" />
            </Grid>
            <Grid item xs>
              <TextField
                fullWidth
                placeholder="Search by email address, phone number, or user UID"
                InputProps={{
                  disableUnderline: true,
                  className: classes.searchInput,
                }}
              />
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" className={classes.addUser}>
                Add user
              </Button>
              <Tooltip title="Reload">
                <IconButton>
                  <RefreshIcon className={classes.block} color="inherit" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
      <div className={classes.contentWrapper}>
        <Typography color="textSecondary" align="center">
          No users for this project yet
        </Typography>
      </div>
      */
