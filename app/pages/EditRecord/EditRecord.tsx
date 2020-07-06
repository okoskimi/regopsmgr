import React, { useState, useEffect } from 'react';
import { ConnectedProps, connect } from 'react-redux';
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

import { RootState } from '../../types/store';
import {
  loadYamlFile,
  fullCanonicalPath,
  extractAssociationsFromData,
  AssociationDataMap,
  extractAssociationsFromSchema,
  AssociationSchemaMap
} from '../../services/files';
import { ObjectSchema, isObjectSchema } from '../../types/schema';
import { saveYamlFile } from '../../services/yaml';

const log = elog.scope('pages/EditRecord');

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
  db: state.database,
  schemas: state.schemas
});

const mapDispatch = {
  markAllAsSeen: null
};
const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const EditRecord = (props: Props) => {
  const { db, schemas } = props;
  const { params: rawParams } = useParams();
  const history = useHistory();

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
  const schema = schemas.byId[params.schema];

  // This is run for every render but only updates data if file was changed
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

  const saveAndExit = (data: any) => {
    const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
    const fullPath = fullCanonicalPath(baseDir, params.path);
    saveYamlFile(fullPath, data);
    history.goBack();
  };

  console.log('UI Schema:', uiSchema);

  return (
    <Form
      schema={fileData.contentSchema as any}
      formData={fileData.contentObj}
      uiSchema={uiSchema}
      onSubmit={event => {
        console.log('Event:', event);
        saveAndExit(event.formData);
      }}
    >
      <div>
        <button type="submit">Save</button>
        <button
          type="button"
          onClick={() => {
            history.goBack();
          }}
        >
          Cancel
        </button>
      </div>
    </Form>
  );
};

export default connector(withStyles(styles)(EditRecord));
