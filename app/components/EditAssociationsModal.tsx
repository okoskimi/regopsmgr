/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */

import React, { forwardRef, useState, useEffect } from 'react';
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
import Alert from '@material-ui/lab/Alert';

import { RootState } from '../types/store';
import { Schema } from '../types/schema';
import { loadData } from '../services/db/query';

const log = elog.scope('components/EditAssociationsModal');

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
  onSave: (associations: Array<string>) => void;
  schema: Schema;
  associationName: string;
  associations: Array<string>;
  minAssociations: number;
  maxAssociations: number;
  columns: Array<Column>;
}
const mapState = (state: RootState) => ({
  db: state.database
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const EditAssociationsModal = (props: Props) => {
  const {
    db,
    open,
    onCancel,
    onSave,
    schema,
    associationName,
    associations,
    minAssociations,
    maxAssociations,
    columns
  } = props;

  const [selected, setSelected] = useState(associations);
  const [maxErrorMsg, setMaxErrorMsg] = useState('');
  const [minErrorMsg, setMinErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [renderVersion, setRenderVersion] = useState(db.version);
  const tableRef: React.RefObject<any> = React.createRef();
  useEffect(() => {
    if (db.version !== renderVersion) {
      if (tableRef.current) {
        tableRef.current.onQueryChange();
      }
      setRenderVersion(db.version);
    }
  });

  useEffect(() => {
    log.info(
      `Setting messages, ${selected.length} associations, max is ${maxAssociations}, min is ${minAssociations}`
    );
    if (maxAssociations > 0) {
      if (selected.length > maxAssociations) {
        // Exceeding maximum will always be more than one so plural will always be correct
        setMaxErrorMsg(
          `You have selected ${selected.length} associations, exceeding the maximum of ${maxAssociations}`
        );
      } else if (maxErrorMsg) {
        setMaxErrorMsg('');
      }
      if (selected.length === maxAssociations) {
        if (maxAssociations > 1) {
          // Max is always more than one so plural is always correct
          setWarningMsg(
            `You have reached the maximum of ${maxAssociations} associations`
          );
        } else {
          setWarningMsg(
            `At most one association may be selected, selecting another will deselect current one`
          );
        }
      } else if (warningMsg) {
        setWarningMsg('');
      }
      if (selected.length < maxAssociations) {
        setInfoMsg(
          `You have selected ${selected.length} association${
            selected.length !== 1 ? 's' : ''
          }, maximum is ${maxAssociations}`
        );
      } else if (infoMsg) {
        setInfoMsg('');
      }
    } else {
      setInfoMsg(
        `You have selected ${selected.length} association${
          selected.length !== 1 ? 's' : ''
        }`
      );
    }
    if (selected.length < minAssociations) {
      if (minAssociations === 1) {
        setMinErrorMsg('You must select at least one association');
      } else {
        setMinErrorMsg(
          `You must select at least ${minAssociations} associations`
        );
      }
    } else if (minErrorMsg) {
      setMinErrorMsg('');
    }
  }, [selected, maxAssociations, minAssociations]);

  const handleSave = () => {
    log.info('handleAdd');
    onSave(selected);
  };

  const handleCancel = () => {
    log.info('handleCancel');
    setSelected(associations);
    onCancel();
  };

  log.info(
    'Edit Associations:',
    db.version,
    schema.$id,
    associations,
    maxAssociations,
    minAssociations
  );

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{`Add ${associationName} association`}</DialogTitle>
      <DialogContent>
        {infoMsg && <Alert severity="info">{infoMsg}</Alert>}
        {warningMsg && <Alert severity="warning">{warningMsg}</Alert>}
        {minErrorMsg && <Alert severity="error">{minErrorMsg}</Alert>}
        {maxErrorMsg && <Alert severity="error">{maxErrorMsg}</Alert>}
        <MaterialTable
          tableRef={tableRef}
          icons={tableIcons}
          columns={columns}
          data={async query => {
            log.info('MaterialTable data request:', query);
            const data = await loadData(
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
            log.silly('Got data', data);
            // Must get() the data, cannot add properties to model instance directly
            data.data = data.data.map(row =>
              selected.includes(row.id)
                ? { ...row.get(), tableData: { checked: true } }
                : row.get()
            );
            log.silly('Returning data', data);
            return data;
          }}
          title={schema.collectiveName}
          options={{
            padding: 'dense',
            selection: true,
            filtering: true,
            showSelectAllCheckbox: false,
            showTextRowsSelected: false
          }}
          onSelectionChange={rows => {
            let newSelection = rows.map(row => row.id as string);
            if (
              maxAssociations === 1 &&
              newSelection.length > maxAssociations
            ) {
              // Automatically deselect previous selection
              newSelection = newSelection.filter(id => !selected.includes(id));
              for (let i = 0; i < rows.length; i++) {
                if (!newSelection.includes(rows[i].id as string)) {
                  // eslint-disable-next-line no-param-reassign
                  (rows[i].tableData as any).checked = false;
                }
              }
            }
            log.info('Setting selected:', newSelection);
            setSelected(newSelection);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="primary">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          disabled={
            (maxAssociations > 0 && selected.length > maxAssociations) ||
            selected.length < minAssociations
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default connector(withStyles(styles)(EditAssociationsModal));
