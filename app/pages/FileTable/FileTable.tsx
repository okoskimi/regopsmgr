/* eslint-disable react/jsx-curly-newline */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */
import React, { forwardRef } from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { useParams } from 'react-router-dom';
import MaterialTable, { Icons } from 'material-table';
import elog from 'electron-log';

import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';
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

import { RootState } from '../../types/store';
import { loadData } from '../../services/database';
import { FILE_MODEL_ID } from '../../constants/database';

const log = elog.scope('pages/FileTable');

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
  db: state.database
});
const mapDispatch = {
  markAllAsSeen: null
};
const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const FileTable = (props: Props) => {
  const { db } = props;
  const { params } = useParams();
  log.debug('Database version:', db.version);
  let options: any = {};
  if (params !== undefined) {
    log.info('We got params:', params);
    options = JSON.parse(Buffer.from(params, 'base64').toString());
    log.info('Parsed params to:', options);
    if (options.files) {
      options.files = new RegExp(options.files);
    }
  } else {
    log.info('No params provided');
  }
  if (!options.title) {
    options.title = 'Files';
  }
  if (!options.columns) {
    options.columns = [
      { title: 'Name', field: 'name' },
      { title: 'Description', field: 'description' },
      { title: 'Path', field: 'path' }
    ];
  }
  log.info('Columns:', options.columns);

  // const { notifications, markAllAsSeen } = props;
  return (
    <div style={{ maxWidth: '100%' }}>
      <MaterialTable
        icons={tableIcons}
        columns={options.columns}
        data={query =>
          loadData(
            FILE_MODEL_ID,
            query.page,
            query.pageSize,
            query.search,
            options.columns
          )
        }
        title={options.title}
      />
    </div>
  );
};

export default connector(withStyles(styles)(FileTable));
