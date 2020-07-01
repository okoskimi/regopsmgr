import React, { ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Alert } from '@material-ui/lab';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
// import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';

import formatDistance from 'date-fns/formatDistance';
import formatISO9075 from 'date-fns/formatISO9075';

import { RootState } from '../../types/store';
import { NotificationType } from '../../types/app';

type OwnProps = {};

const mapState = (state: RootState) => ({
  notifications: state.notifications
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);

type Props = ConnectedProps<typeof connector> & OwnProps;

const useStyles = makeStyles({
  title: {
    width: '100%',
    textAlign: 'center'
  },
  alertList: {
    width: '100%'
  }
});

interface NotificationProps {
  type: NotificationType;
  seen: boolean;
  children: ReactNode;
}
const NotificationElement = (props: NotificationProps) => {
  const { type, seen } = props;
  return (
    <Alert variant={seen ? 'outlined' : 'filled'} severity={type}>
      {props.children}
    </Alert>
  );
};

const Notifications = (props: Props) => {
  const { notifications } = props;
  const classes = useStyles();
  const now = new Date();

  return (
    <div>
      <h1 className={classes.title}>Notifications</h1>
      <TableContainer className={classes.alertList}>
        <Table className={classes.alertList}>
          <TableHead>
            <TableRow className={classes.alertList}>
              <TableCell>Notification</TableCell>
              <TableCell>Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.data.map(msg => (
              <TableRow key={msg.id}>
                <TableCell>
                  <NotificationElement seen={msg.seen} type={msg.type}>
                    {msg.message}
                  </NotificationElement>
                </TableCell>
                <TableCell>
                  {`${formatDistance(new Date(msg.timestamp), now)} ago`}
                  <br />
                  {formatISO9075(new Date(msg.timestamp))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default connector(Notifications);
