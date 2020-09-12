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
  selectSchema
} from '../../services/files';
import {
  ObjectSchema,
  isObjectSchema,
  defaultSchema,
  AssociationDataMap,
  extractAssociationsFromData,
  extractAssociationsFromSchema,
  AssociationDefinition
} from '../../types/schema';
import { saveYamlFile, loadYamlFile, Comments } from '../../services/yaml';
import { updateDatabase } from '../../reducers/database';
import { loadObjectFileToDatabase } from '../../services/db/dbfiles';
import { loadData, loadAssociationMap } from '../../services/db/query';
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

  interface RecordData {
    contentObj?: any;
    modified?: number;
    associations?: AssociationDataMap;
    associationVersion: number;
  }

  interface RecordSchema {
    contentSchema?: ObjectSchema;
    associationNames?: Array<string>;
    associationByName?: {
      [name: string]: AssociationDefinition;
    };
  }

  interface ModalMap {
    [name: string]: boolean;
  }

  const initialRecordData: RecordData = { associationVersion: 0 };
  const initialRecordSchema: RecordSchema = {};
  const initialRefs: TableRefMap = {};
  const modalsInitialState: ModalMap = {};

  const [recordData, setRecordData] = useState(initialRecordData);
  const [recordSchema, setRecordSchema] = useState(initialRecordSchema);
  const [modals, setModals] = useState(modalsInitialState);
  const [tableRefs, setTableRefs] = useState(initialRefs);

  log.debug('Database version:', db.version);
  let params: any = {};
  if (rawParams !== undefined) {
    log.info('We got params:', rawParams);
    params = JSON.parse(Buffer.from(rawParams, 'base64').toString());
    log.info('Parsed params to:', params);
  } else {
    log.error('No params provided');
    throw new Error('EditRecord requires at least path parameter!');
  }

  if (!params.path) {
    log.error('EditRecord requires at least path parameter!');
    throw new Error('EditRecord requires at least path parameter!');
  }

  let schema = defaultSchema;
  if (params.schemaId) {
    schema = schemas.byId[params.schemaId];
  } else {
    schema = selectSchema(params.path, schemas);
  }

  // This is run for every render but only updates data if file was changed
  // Note that it does not react to database updates, so external changes to file won't trigger update if there is no rerender
  // This prevents (not tested) form from changing in mid-edit if file is changed
  // FIXME: On the other hand, database changes may trigger re-render since db is in props?
  useEffect(() => {
    const loadFile = async () => {
      const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
      const fullPath = fullCanonicalPath(baseDir, params.path);
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs !== recordData.modified && isObjectSchema(schema)) {
        const rawContent = await loadYamlFile(fullPath, {
          schemaId: schema.$id,
          markAsChanged: true
        });
        const { contentObj, associations } = extractAssociationsFromData(
          schema,
          rawContent
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
        setRecordData({
          contentObj,
          associations,
          modified: stat.mtimeMs,
          associationVersion: recordData.associationVersion + 1
        });
        setRecordSchema({
          contentSchema,
          associationNames,
          associationByName
        });
      }
    };
    loadFile();
  });

  if (!params.title) {
    params.title = schema.name;
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
    !recordData.contentObj ||
    !recordSchema.contentSchema ||
    !recordData.associations ||
    !recordSchema.associationNames
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
  } else if (recordSchema.contentSchema.uiSchema) {
    uiSchema = recordSchema.contentSchema.uiSchema;
  }

  // Save to file and database
  const saveData = async (data: any) => {
    assertIsDefined(recordData.associations);
    assertIsDefined(recordSchema.associationNames);
    console.log('Saving with associations:', recordData.associations);
    const dataWithAssociations = { ...data };
    const associationMap = await loadAssociationMap(recordData.associations);
    const comments: Comments = {};
    Object.keys(associationMap).forEach(key => {
      comments[key] = {
        comment: (associationMap[key] as any).name,
        force: true
      };
    });
    recordSchema.associationNames.forEach(associationName => {
      assertIsDefined(recordData.associations);
      assertIsDefined(recordSchema.associationByName);
      if (recordData.associations[associationName].instances.length > 0) {
        if (
          ['BelongsToMany', 'HasMany'].includes(
            recordSchema.associationByName[associationName].relationship
          )
        ) {
          const value = recordData.associations[associationName].instances;
          dataWithAssociations[associationName] = value;
        } else {
          const value = recordData.associations[associationName].instances[0];
          dataWithAssociations[associationName] = value;
        }
      }
    });
    // Fetch names for each association
    const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
    const fullPath = fullCanonicalPath(baseDir, params.path);
    // This suppresses the file change event so we need to explicitly save to database
    // Explicit saving is more reliable than relying on file change events
    await saveYamlFile(fullPath, dataWithAssociations, {
      markAsChanged: true,
      comments
    });
    if (isObjectSchema(schema)) {
      await loadObjectFileToDatabase(
        relativePathFromCanonical(params.path),
        baseDir,
        schema
      );
      dispatch(updateDatabase());
    } else {
      log.error(`Schema for ${params.path} is not an object schema!`);
    }
  };

  console.log('UI Schema:', uiSchema);
  console.log('Association names:', recordSchema.associationNames);
  console.log('FileData:', recordData);

  return (
    <div className={classes.root}>
      <h2>{params.title}</h2>
      <Form
        schema={recordSchema.contentSchema as any}
        formData={recordData.contentObj}
        uiSchema={uiSchema}
        onSubmit={event => {
          saveData(event.formData);
          history.goBack();
        }}
      >
        <div>
          <hr />
          <h3>Associations</h3>
          {recordSchema.associationNames.map(associationName => {
            assertIsDefined(recordData.associations);
            console.log('Rendering association:', associationName);
            console.log('Data:', recordData.associations[associationName]);
            let columns = defaultAssociationColumns;
            if (
              params.associationColumns &&
              params.associationColumns[associationName]
            ) {
              columns = params.associationColumns[associationName];
            }
            assertIsDefined(recordSchema.associationByName);
            const hasAssociations =
              recordData.associations[associationName].instances.length > 0;
            const isLong =
              recordData.associations[associationName].instances.length > 5;
            const relation =
              recordSchema.associationByName[associationName].relationship;
            let maxAssociations = 0;
            if (['HasOne', 'BelongsTo'].includes(relation)) {
              maxAssociations = 1;
            } else if (
              recordSchema.associationByName[associationName].maxItems
            ) {
              // TS does not respect above check for undefined so need to cast
              maxAssociations = recordSchema.associationByName[associationName]
                .maxItems as number;
            }
            let minAssociations = 0;
            if (recordSchema.associationByName[associationName].minItems) {
              // TS does not respect above check for undefined so need to cast
              minAssociations = recordSchema.associationByName[associationName]
                .minItems as number;
            }
            return (
              <div key={associationName}>
                <MaterialTable
                  tableRef={tableRefs[associationName]}
                  icons={tableIcons}
                  columns={columns}
                  data={query => {
                    log.info('MaterialTable data request:', query);
                    assertIsDefined(recordSchema.contentSchema);
                    assertIsDefined(recordData.associations);
                    return loadData(
                      recordData.associations[associationName].modelId,
                      query.page,
                      query.pageSize,
                      query.search,
                      columns,
                      query.orderBy,
                      query.orderDirection,
                      query.filters,
                      {
                        id: recordData.associations[associationName].instances
                      }
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
                    }
                  ]}
                />
                <AddAssociationModal
                  open={!!modals[associationName]}
                  onCancel={() => {
                    setModals({ ...modals, [associationName]: false });
                  }}
                  onOk={(associations: Array<string>) => {
                    setModals({ ...modals, [associationName]: false });
                    if (
                      recordData.associations &&
                      recordData.associations[associationName]
                    ) {
                      setRecordData({
                        ...recordData,
                        associationVersion: recordData.associationVersion + 1,
                        associations: {
                          ...recordData.associations,
                          [associationName]: {
                            modelId:
                              recordData.associations[associationName].modelId,
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
                    schemas.byId[
                      recordSchema.associationByName[associationName].target
                    ]
                  }
                  associationName={associationName}
                  associations={
                    hasAssociations
                      ? recordData.associations[associationName].instances
                      : []
                  }
                  dataVersion={recordData.associationVersion}
                  maxAssociations={maxAssociations}
                  minAssociations={minAssociations}
                />
                <br />
              </div>
            );
          })}
        </div>
        <div className={classes.buttons}>
          <Button
            variant="contained"
            onClick={() => {
              history.goBack();
            }}
          >
            Back
          </Button>
          <Button type="submit" variant="contained" color="primary">
            Save
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default connector(withStyles(styles)(EditRecord));
