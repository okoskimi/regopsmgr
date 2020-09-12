/* eslint-disable no-console */
/* eslint-disable no-alert */
/* eslint-disable no-restricted-globals */
/* eslint-disable react/jsx-curly-newline */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */
import React, { forwardRef, useState, useEffect } from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
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
import { loadData, convertFilter } from '../../services/db/query';
import {
  isObjectSchema,
  getNonFilterableFieldsFromSchema
} from '../../types/schema';

const log = elog.scope('pages/RecordTable');

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
    root: {
      maxWidth: '100%',
      margin: 0
    }
  });

interface OwnProps extends WithStyles<typeof styles> {
  onDrawerToggle: () => void;
}
const mapState = (state: RootState) => ({
  db: state.database,
  schemas: state.schemas
});
const mapDispatch = {
  markAllAsSeen: null
};
const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const RecordTable = (props: Props) => {
  const { db, schemas, classes } = props;
  const { params: rawParams } = useParams();
  const history = useHistory();
  const tableRef: React.RefObject<any> = React.createRef();
  const [renderVersion, setRenderVersion] = useState(db.version);
  log.debug('Database version:', db.version);
  log.debug('Render version:', renderVersion);

  let params: any = {};
  if (rawParams !== undefined) {
    log.info('We got params:', rawParams);
    params = JSON.parse(Buffer.from(rawParams, 'base64').toString());
    log.info('Parsed params to:', params);
    if (params.filter) {
      params.filter = convertFilter(params.filter);
    }
  } else {
    log.info('No params provided');
  }

  const [renderSchemaId, setRenderSchemaId] = useState(params.schemaId);
  useEffect(() => {
    if (db.version !== renderVersion || params.schemaId !== renderSchemaId) {
      log.debug('Updating table');
      if (tableRef.current) {
        log.debug('calling onQueryChange');
        tableRef.current.onQueryChange();
        log.debug('onQueryChange called');
      } else {
        log.debug('No tableRef:', tableRef.current);
      }
      log.debug('Setting render version and model');
      setRenderVersion(db.version);
      setRenderSchemaId(params.schemaId);
      log.debug('Set render version');
    }
  });

  if (!params.title) {
    params.title = 'Files';
  }
  if (!params.schemaId) {
    log.error(`Schema ID not defined`);
    throw new Error(`Schema ID not defined`);
  }
  const schema = schemas.byId[params.schemaId];
  if (!schema) {
    return (
      <div>
        <h1>Error</h1>
        <p>{`Unknown Schema ID ${params.schemaId}`}</p>
      </div>
    );
  }
  if (!isObjectSchema(schema)) {
    return (
      <div>
        <h1>Error</h1>
        <p>{`Schema ${params.schemaId} is not an object type Schema`}</p>
      </div>
    );
  }
  if (!params.columns) {
    params.columns = [
      { title: 'Name', field: 'name' },
      { title: 'Description', field: 'description' },
      { title: 'Path', field: 'path' }
    ];
  } else {
    // Disable filtering for columns that use nested properties
    // TBD: Association nested properties could technically be handled by SQL if they are not nested within the
    // associated object
    const nonFilterable = getNonFilterableFieldsFromSchema(schema);
    params.columns = params.columns.map((column: any) => {
      const dotPosition = column.field.indexOf('.');
      if (dotPosition < 0 && !nonFilterable.includes(column.field)) {
        return column;
      }
      return { ...column, filtering: false };
    });
  }
  // TODO: Implement lookup configuration in columns based on enumNames
  log.info('Columns:', params.columns);

  // const { notifications, markAllAsSeen } = props;
  return (
    <div className={classes.root}>
      <MaterialTable
        tableRef={tableRef}
        icons={tableIcons}
        columns={params.columns}
        data={query => {
          log.info('MaterialTable data request:', query);
          log.info('Virtual includes:', schema.virtualIncludes);
          const result = loadData(
            schema.$id,
            query.page,
            query.pageSize,
            query.search,
            params.columns,
            query.orderBy,
            query.orderDirection,
            query.filters,
            params.filter,
            schema.virtualIncludes
          );
          log.info('Got result:', result);
          return result;
        }}
        title={params.title}
        options={{ filtering: true }}
        onRowClick={(event, eventRowData: any) => {
          const linkParams = {
            schemaId: schema.$id,
            path: eventRowData.path,
            uiSchema: params.uiSchema // May be undefined
          };
          history.push(
            `/EditRecord/${Buffer.from(JSON.stringify(linkParams)).toString(
              'base64'
            )}`
          );
        }}
      />
    </div>
  );
};

export default connector(withStyles(styles)(RecordTable));
