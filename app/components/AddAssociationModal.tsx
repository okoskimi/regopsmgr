/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */

import React, { forwardRef } from 'react';
import { ConnectedProps, connect } from 'react-redux';
import MaterialTable, { Icons } from 'material-table';
import elog from 'electron-log';

import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import AddBox from '@material-ui/icons/AddBox';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import Check from '@material-ui/icons/Check';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import Clear from '@material-ui/icons/Clear';
import DeleteOutline from '@material-ui/icons/DeleteOutline';
import Edit from '@material-ui/icons/Edit';
import FilterList from '@material-ui/icons/FilterList';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';
import Remove from '@material-ui/icons/Remove';
import SaveAlt from '@material-ui/icons/SaveAlt';
import Search from '@material-ui/icons/Search';
import ViewColumn from '@material-ui/icons/ViewColumn';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

import { RootState } from '../types/store';

import { Schema } from '../types/schema';
import { loadData } from '../services/db/query';

const log = elog.scope('components/AddAssociation');

const tableIcons: Icons = {
  Add: forwardRef((props, ref) => <AddBox {...props} ref={ref} />),
  Check: forwardRef((props, ref) => <Check {...props} ref={ref} />),
  Clear: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Delete: forwardRef((props, ref) => <DeleteOutline {...props} ref={ref} />),
  DetailPanel: forwardRef((props, ref) => (
    <ChevronRight {...props} ref={ref} />
  )),
  Edit: forwardRef((props, ref) => <Edit {...props} ref={ref} />),
  Export: forwardRef((props, ref) => <SaveAlt {...props} ref={ref} />),
  Filter: forwardRef((props, ref) => <FilterList {...props} ref={ref} />),
  FirstPage: forwardRef((props, ref) => <FirstPage {...props} ref={ref} />),
  LastPage: forwardRef((props, ref) => <LastPage {...props} ref={ref} />),
  NextPage: forwardRef((props, ref) => <ChevronRight {...props} ref={ref} />),
  PreviousPage: forwardRef((props, ref) => (
    <ChevronLeft {...props} ref={ref} />
  )),
  ResetSearch: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Search: forwardRef((props, ref) => <Search {...props} ref={ref} />),
  SortArrow: forwardRef((props, ref) => <ArrowUpward {...props} ref={ref} />),
  ThirdStateCheck: forwardRef((props, ref) => <Remove {...props} ref={ref} />),
  ViewColumn: forwardRef((props, ref) => <ViewColumn {...props} ref={ref} />)
};

const styles = (theme: Theme) =>
  createStyles({
    root: {
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(2),
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1)
    },
    buttons: {
      '& > *': {
        margin: theme.spacing(1)
      }
    }
  });

interface Column {
  title: string;
  field: string;
}

interface OwnProps extends WithStyles<typeof styles> {
  open: boolean;
  onCancel: () => void;
  onAdd: (association: string) => void;
  schema: Schema;
  associationName: string;
  associations: Array<string>;
  columns: Array<Column>;
}
const mapState = (state: RootState) => ({
  db: state.database
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const AddAssociationModal = (props: Props) => {
  const {
    db,
    open,
    onCancel,
    onAdd,
    schema,
    associationName,
    associations,
    columns
  } = props;

  const handleAdd = () => {
    log.info('handleAdd');
    onAdd('foo');
  };

  log.debug('Database version:', db.version, schema, associations);

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{`Add ${associationName} association`}</DialogTitle>
      <DialogContent>
        <MaterialTable
          icons={tableIcons}
          columns={columns}
          data={query => {
            log.info('MaterialTable data request:', query);
            return loadData(
              schema.$id,
              query.page,
              query.pageSize,
              query.search,
              columns,
              query.orderBy,
              query.orderDirection,
              query.filters,
              null
            );
          }}
          title={schema.collectiveName}
          options={{
            padding: 'dense'
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          Cancel
        </Button>
        <Button onClick={handleAdd} color="primary">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default connector(withStyles(styles)(AddAssociationModal));
