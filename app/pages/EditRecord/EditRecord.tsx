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
import AddAssociationModal from '../../components/EditAssociationsModal';

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

  interface TableRefMap {
    [name: string]: React.RefObject<any>;
  }

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
  const initialRefs: TableRefMap = {};
  const modalsInitialState: ModalMap = {};

  const [fileData, setFileData] = useState(initialData);
  const [modals, setModals] = useState(modalsInitialState);
  const [tableRefs, setTableRefs] = useState(initialRefs);

  log.debug('Database version:', db.version);
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
        const rawContent = await loadYamlFile(fullPath, {
          schemaId: schema.$id,
          markAsChanged: true
        });
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
        log.info('Setting tableRefs');
        const refs: TableRefMap = {};
        associationNames.forEach(name => {
          log.info('Setting tableRef for ', name);
          refs[name] = React.createRef();
          const association = associationByName[name];
          if (!associations[name]) {
            associations[name] = {
              modelId: association.target,
              instances: []
            };
          }
        });
        setTableRefs(refs);

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
    await saveYamlFile(fullPath, data, { markAsChanged: true });
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
  console.log('FileData:', fileData);

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
        assertIsDefined(fileData.associationByName);
        const hasAssociations =
          fileData.associations[associationName].instances.length > 0;
        const isLong =
          fileData.associations[associationName].instances.length > 5;
        const relation =
          fileData.associationByName[associationName].relationship;
        let maxAssociations = 0;
        if (['HasOne', 'BelongsTo'].includes(relation)) {
          maxAssociations = 1;
        } else if (fileData.associationByName[associationName].maxItems) {
          // TS does not respect above check for undefined so need to cast
          maxAssociations = fileData.associationByName[associationName]
            .maxItems as number;
        }
        let minAssociations = 2;
        if (fileData.associationByName[associationName].minItems) {
          // TS does not respect above check for undefined so need to cast
          minAssociations = fileData.associationByName[associationName]
            .minItems as number;
        }
        return (
          <div key={associationName}>
            {hasAssociations ? (
              <MaterialTable
                tableRef={tableRefs[associationName]}
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
                    icon: () => <Edit />,
                    tooltip: 'Edit Associations',
                    isFreeAction: true,
                    onClick: () =>
                      setModals({ ...modals, [associationName]: true })
                  },
                  {
                    icon: () => <Delete />,
                    tooltip: 'Remove Association',
                    onClick: (_event, rowData: any) => {
                      if (
                        fileData.associations &&
                        fileData.associations[associationName]
                      ) {
                        setFileData({
                          ...fileData,
                          associations: {
                            ...fileData.associations,
                            [associationName]: {
                              modelId:
                                fileData.associations[associationName].modelId,
                              instances: fileData.associations[
                                associationName
                              ].instances.filter(id => id !== rowData.id)
                            }
                          }
                        });
                        if (tableRefs[associationName].current) {
                          tableRefs[associationName].current.onQueryChange();
                        }
                      }
                    }
                  }
                ]}
              />
            ) : (
              <MaterialTable
                tableRef={tableRefs[associationName]}
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
                    icon: () => <Edit />,
                    tooltip: 'Edit Associations',
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
              onSave={(associations: Array<string>) => {
                setModals({ ...modals, [associationName]: false });
                if (
                  fileData.associations &&
                  fileData.associations[associationName]
                ) {
                  setFileData({
                    ...fileData,
                    associations: {
                      ...fileData.associations,
                      [associationName]: {
                        modelId: fileData.associations[associationName].modelId,
                        instances: associations
                      }
                    }
                  });
                  if (tableRefs[associationName].current) {
                    tableRefs[associationName].current.onQueryChange();
                  }
                } else {
                  log.error('Associations state not found!');
                }
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
              maxAssociations={maxAssociations}
              minAssociations={minAssociations}
            />
            <br />
          </div>
        );
      })}
    </div>
  );
};

export default connector(withStyles(styles)(EditRecord));
