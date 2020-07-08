import React, { useState, useEffect } from 'react';
import { ConnectedProps, connect, useDispatch } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
import { promises as fsp } from 'fs';
import pathlib from 'path';
import elog from 'electron-log';

import Form from '@rjsf/material-ui';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';

import { RootState } from '../../types/store';
import {
  fullCanonicalPath,
  relativePathFromCanonical,
  extractAssociationsFromData,
  AssociationDataMap,
  extractAssociationsFromSchema,
  AssociationSchemaMap
} from '../../services/files';
import { ObjectSchema, isObjectSchema } from '../../types/schema';
import { saveYamlFile, loadYamlFile } from '../../services/yaml';
import { updateDatabase } from '../../reducers/database';
import { loadObjectFileToDatabase } from '../../services/db/dbfiles';

const log = elog.scope('pages/EditRecord');

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
    associationSchemas?: AssociationSchemaMap;
  }

  const initialData: FileData = {};

  const [fileData, setFileData] = useState(initialData);

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
          associationSchemas
        } = extractAssociationsFromSchema(schema);
        console.log('Setting contentSchema to:', contentSchema);
        setFileData({
          contentObj,
          contentSchema,
          associations,
          associationSchemas,
          modified: stat.mtimeMs
        });
      }
    };
    loadFile();
  });

  if (!params.title) {
    params.title = 'Files';
  }
  if (
    !fileData.contentObj ||
    !fileData.contentSchema ||
    !fileData.associations ||
    !fileData.associationSchemas
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

  return (
    <div className={classes.root}>
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
    </div>
  );
};

export default connector(withStyles(styles)(EditRecord));
