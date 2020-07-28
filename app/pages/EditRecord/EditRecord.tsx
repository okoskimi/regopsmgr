/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */

import React, { forwardRef, useState, useEffect } from 'react';
import { ConnectedProps, connect, useDispatch } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
import { promises as fsp } from 'fs';
import pathlib from 'path';
import MaterialTable, { Icons } from 'material-table';
import elog from 'electron-log';

import Form from '@rjsf/material-ui';
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
import Delete from '@material-ui/icons/Delete';
import Edit from '@material-ui/icons/Edit';
import FilterList from '@material-ui/icons/FilterList';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';
import Remove from '@material-ui/icons/Remove';
import SaveAlt from '@material-ui/icons/SaveAlt';
import Search from '@material-ui/icons/Search';
import ViewColumn from '@material-ui/icons/ViewColumn';

import { RootState } from '../../types/store';
import {
  fullCanonicalPath,
  relativePathFromCanonical,
  extractAssociationsFromData,
  AssociationDataMap,
  extractAssociationsFromSchema,
  AssociationDefinition
} from '../../services/files';
import { ObjectSchema, isObjectSchema } from '../../types/schema';
import { saveYamlFile, loadYamlFile } from '../../services/yaml';
import { updateDatabase } from '../../reducers/database';
import { loadObjectFileToDatabase } from '../../services/db/dbfiles';
import { loadData } from '../../services/db/query';
import { assertIsDefined } from '../../types/util';
import AddAssociationModal from '../../components/AddAssociationModal';

const log = elog.scope('pages/EditRecord');

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

type OwnProps = WithStyles<typeof styles>;
/*
interface OwnProps extends WithStyles<typeof styles> {
  ...
}
*/

const mapState = (state: RootState) => ({
  db: state.database,
  schemas: state.schemas
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const EditRecord = (props: Props) => {
  const { db, schemas, classes } = props;
  const { params: rawParams } = useParams();
  const history = useHistory();
  const dispatch = useDispatch();

  interface FileData {
    contentObj?: any;
    contentSchema?: ObjectSchema;
    modified?: number;
    associations?: AssociationDataMap;
    associationNames?: Array<string>;
    associationByName?: {
      [name: string]: AssociationDefinition;
    };
  }

  interface ModalMap {
    [name: string]: boolean;
  }

  const initialData: FileData = {};
  const modalsInitialState: ModalMap = {};

  const [fileData, setFileData] = useState(initialData);
  const [modals, setModals] = useState(modalsInitialState);

  log.debug('Database version:', db.version, schemas, history);
  let params: any = {};
  if (rawParams !== undefined) {
    log.info('We got params:', rawParams);
    params = JSON.parse(decodeURIComponent(rawParams));
    log.info('Parsed params to:', params);
  } else {
    log.info('No params provided');
  }
  const schema = schemas.byId[params.schemaId];

  // This is run for every render but only updates data if file was changed
  // Note that it does not react to database updates, so external changes to file won't trigger update if there is no rerender
  // This prevents (not tested) form from changing in mid-edit if file is changed
  useEffect(() => {
    const loadFile = async () => {
      const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
      const fullPath = fullCanonicalPath(baseDir, params.path);
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs !== fileData.modified && isObjectSchema(schema)) {
        const rawContent = await loadYamlFile(schema, fullPath);
        const { contentObj, associations } = extractAssociationsFromData(
          schema,
          rawContent,
          false
        );
        const {
          contentSchema,
          associationNames,
          associationByName
        } = extractAssociationsFromSchema(schema);

        console.log('Setting contentSchema to:', contentSchema);
        setFileData({
          contentObj,
          contentSchema,
          associations,
          associationNames,
          associationByName,
          modified: stat.mtimeMs
        });
      }
    };
    loadFile();
  });

  if (!params.title) {
    params.title = 'Files';
  }

  const defaultAssociationColumns = [
    { title: 'Name', field: 'name' },
    { title: 'ID', field: 'id' }
  ];

  if (params.associationColumns) {
    // Disable filtering for columns that use deep properties that are not visible to SQL
    params.associationColumns = params.associationColumns.map((column: any) => {
      if (column.field.indexOf('.') < 0) {
        return column;
      }
      return { ...column, filtering: false };
    });
  }

  if (
    !fileData.contentObj ||
    !fileData.contentSchema ||
    !fileData.associations ||
    !fileData.associationNames
  ) {
    return (
      <div>
        <p>Loading...</p>
      </div>
    );
  }
  let uiSchema = {
    'ui:order': ['id', 'name', '*']
  };
  if (params.uiSchema) {
    uiSchema = params.uiSchema;
  } else if (fileData.contentSchema.uiSchema) {
    uiSchema = fileData.contentSchema.uiSchema;
  }

  // Save to file and database
  const saveData = async (data: any) => {
    const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
    const fullPath = fullCanonicalPath(baseDir, params.path);
    // This suppresses the file change event so we need to explicitly save to database
    // Explicit saving is more reliable than relying on file change events
    await saveYamlFile(fullPath, data);
    if (fileData.contentSchema) {
      await loadObjectFileToDatabase(
        relativePathFromCanonical(params.path),
        baseDir,
        fileData.contentSchema
      );
      dispatch(updateDatabase());
    } else {
      log.error(`Schema for ${params.path} is not an object schema!`);
    }
  };

  console.log('UI Schema:', uiSchema);
  console.log('Association names:', fileData.associationNames);

  return (
    <div className={classes.root}>
      <h2>{`Edit ${schema.name}`}</h2>
      <Form
        schema={fileData.contentSchema as any}
        formData={fileData.contentObj}
        uiSchema={uiSchema}
        onSubmit={event => {
          saveData(event.formData);
          history.goBack();
        }}
      >
        <div className={classes.buttons}>
          <Button type="submit" variant="contained" color="primary">
            Save
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              history.goBack();
            }}
          >
            Cancel
          </Button>
        </div>
      </Form>
      <hr />
      <h3>Associations</h3>
      {fileData.associationNames.map(associationName => {
        assertIsDefined(fileData.associations);
        console.log('Rendering association:', associationName);
        console.log('Data:', fileData.associations[associationName]);
        let columns = defaultAssociationColumns;
        if (
          params.associationColumns &&
          params.associationColumns[associationName]
        ) {
          columns = params.associationColumns[associationName];
        }
        /*
        if (!fileData.associations[associationName]) {
          return (
            <div key={associationName}>
              <p>{`No ${associationName} associations.`}</p>
            </div>
          );
        }
        */
        assertIsDefined(fileData.associationByName);
        const hasAssociations = !!fileData.associations[associationName];
        const isLong = hasAssociations
          ? fileData.associations[associationName].instances.length > 5
          : false;
        const relation =
          fileData.associationByName[associationName].relationship;
        const useAddIcon =
          ['HasMany', 'BelongsToMany'].includes(relation) || !hasAssociations;
        return (
          <div key={associationName}>
            {hasAssociations ? (
              <MaterialTable
                icons={tableIcons}
                columns={columns}
                data={query => {
                  log.info('MaterialTable data request:', query);
                  assertIsDefined(fileData.contentSchema);
                  assertIsDefined(fileData.associations);
                  return loadData(
                    fileData.associations[associationName].modelId,
                    query.page,
                    query.pageSize,
                    query.search,
                    columns,
                    query.orderBy,
                    query.orderDirection,
                    query.filters,
                    { id: fileData.associations[associationName].instances }
                  );
                }}
                title={associationName}
                options={{
                  padding: 'dense',
                  search: isLong,
                  paging: isLong
                }}
                actions={[
                  {
                    icon: () => (useAddIcon ? <AddBox /> : <Edit />),
                    tooltip: useAddIcon
                      ? 'Add Association'
                      : 'Change Association',
                    isFreeAction: true,
                    onClick: () =>
                      setModals({ ...modals, [associationName]: true })
                  },
                  {
                    icon: () => <Delete />,
                    tooltip: 'Remove Association',
                    onClick: (event, rowData: any) =>
                      alert(`You removed ${rowData.id}`)
                  }
                ]}
              />
            ) : (
              <MaterialTable
                icons={tableIcons}
                columns={[{ title: 'Data', field: 'data' }]}
                data={[{ data: 'No Data' }]}
                title={associationName}
                options={{
                  padding: 'default',
                  search: false,
                  header: false,
                  paging: false
                }}
                actions={[
                  {
                    icon: () => (useAddIcon ? <AddBox /> : <Edit />),
                    tooltip: useAddIcon
                      ? 'Add Association'
                      : 'Change Association',
                    isFreeAction: true,
                    onClick: () =>
                      setModals({ ...modals, [associationName]: true })
                  }
                ]}
              />
            )}
            <AddAssociationModal
              open={!!modals[associationName]}
              onCancel={() => {
                setModals({ ...modals, [associationName]: false });
              }}
              onAdd={(association: string) => {
                alert(`Add association ${association}`);
              }}
              columns={columns}
              schema={
                schemas.byId[fileData.associationByName[associationName].target]
              }
              associationName={associationName}
              associations={
                hasAssociations
                  ? fileData.associations[associationName].instances
                  : []
              }
            />
            <br />
          </div>
        );
      })}
    </div>
  );
};

export default connector(withStyles(styles)(EditRecord));
