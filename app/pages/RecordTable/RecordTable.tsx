import React from 'react';
import { ConnectedProps, connect } from 'react-redux';

import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';

import { RootState } from '../../reducers/types';

const styles = (_theme: Theme) =>
  createStyles({
    secondaryBar: {
      zIndex: 0
    }
  });

interface OwnProps extends WithStyles<typeof styles> {
  onDrawerToggle: () => void;
}
const mapState = (state: RootState) => ({
  notifications: state.notifications
});
const mapDispatch = {
  markAllAsSeen: null
};
const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const RecordTable = (_props: Props) => {
  // const { notifications, markAllAsSeen } = props;
  return <div />;
};

export default connector(withStyles(styles)(RecordTable));
