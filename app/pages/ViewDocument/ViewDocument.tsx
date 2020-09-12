/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/display-name */

import React, { useState, useEffect } from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
import ReactMarkdown from 'react-markdown/with-html';
import { promises as fsp } from 'fs';
import pathlib from 'path';
import ejs from 'ejs';
import elog from 'electron-log';

import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from '@material-ui/core/styles';
import { Button } from '@material-ui/core';

import { RootState } from '../../types/store';
import { fullCanonicalPath, selectSchema } from '../../services/files';
import {
  isDocumentSchema,
  defaultSchema,
  isObjectSchema
} from '../../types/schema';
import { database } from '../../services/db';
import { getVirtualIncludes } from '../../services/db/query';

const log = elog.scope('pages/ViewDocument');

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

const mapState = (state: RootState) => ({
  db: state.database,
  schemas: state.schemas
});

const mapDispatch = {};

const connector = connect(mapState, mapDispatch);
type Props = ConnectedProps<typeof connector> & OwnProps;

const ViewDocument = (props: Props) => {
  const { db, schemas, classes } = props;
  const { params: rawParams } = useParams();
  const history = useHistory();

  log.debug('Database version:', db.version);
  let params: any = {};
  if (rawParams !== undefined) {
    log.info('We got params:', rawParams);
    params = JSON.parse(Buffer.from(rawParams, 'base64').toString());
    log.info('Parsed params to:', params);
  } else {
    log.error('No params provided');
    throw new Error('ViewDocument requires at least path parameter!');
  }

  if (!params.path) {
    log.error('ViewDocument requires at least path parameter!');
    throw new Error('ViewDocument requires at least path parameter!');
  }

  let schema = defaultSchema;
  if (params.schemaId) {
    schema = schemas.byId[params.schemaId];
  } else {
    schema = selectSchema(params.path, schemas);
  }
  if (!params.title) {
    params.title = 'Document';
  }

  const [fileContents, setFileContents] = useState({ data: '', modified: -1 });
  const [templateOutput, setTemplateOutput] = useState('');
  const [htmlOutput, setHtmlOutput] = useState(<div />);

  // Load raw file data, except for ejs templating also do templating
  // This is run whenever db is changed (which happens if file is changed) but only updates file contents if file was changed
  useEffect(() => {
    // Need to call separate function to use await
    const loadFile = async () => {
      if (!isDocumentSchema(schema)) {
        return;
      }
      const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
      const fullPath = fullCanonicalPath(baseDir, params.path);
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs !== fileContents.modified) {
        if (schema.templating === 'ejs') {
          // Just modify timestamp, data will be loaded by ejs
          setFileContents({ data: '', modified: stat.mtimeMs });
        } else {
          const rawContent = await fsp.readFile(fullPath, { encoding: 'utf8' });
          setFileContents({ data: rawContent, modified: stat.mtimeMs });
        }
      }
    };
    loadFile();
  }, [db.version]);

  useEffect(() => {
    console.log('Running template');
    const runTemplate = async () => {
      if (!isDocumentSchema(schema)) {
        return;
      }
      if (schema.templating === 'ejs') {
        const baseDir = pathlib.join(process.cwd(), '..', 'branchtest');
        const fullPath = fullCanonicalPath(baseDir, params.path);
        // const ejsInput = `<%- include(${fullPath});%>`;
        const models: any = {};
        const addVirtualIncludes = (options: any, schemaId: string) => {
          const includeSchema = schemas.byId[schemaId];
          if (isObjectSchema(includeSchema)) {
            log.info(
              `Virtual includes: ${JSON.stringify(
                includeSchema.virtualIncludes
              )}`
            );
            const newOptions = { ...options };
            if (options.include) {
              newOptions.include = options.include.concat(
                getVirtualIncludes(includeSchema.virtualIncludes)
              );
            } else {
              newOptions.include = getVirtualIncludes(
                includeSchema.virtualIncludes
              );
            }
            return newOptions;
          }
          return options;
        };
        Object.keys(database.models).forEach(key => {
          models[key] = Object.create(database.models[key]);
          const model = models[key];
          model.findAll = async (options: any) => {
            log.info(`Document findAll: ${JSON.stringify(options)}`);
            log.info(
              `Augmented options: ${JSON.stringify(
                addVirtualIncludes(options, key)
              )}`
            );
            try {
              log.info('Making query');
              const result = await Object.getPrototypeOf(model).findAll(
                addVirtualIncludes(options, key)
              );
              log.info('Got result: ', result);
              return result;
            } catch (error) {
              log.error('Document query failed', error);
              return undefined;
            }
          };
          model.findAndCountAll = (options: any) =>
            Object.getPrototypeOf(model).findAndCountAll(
              addVirtualIncludes(options, key)
            );
          model.findByPk = (param: any, options: any) =>
            Object.getPrototypeOf(model).findByPk(
              param,
              addVirtualIncludes(options, key)
            );
          model.findOne = (options: any) =>
            Object.getPrototypeOf(model).findOne(
              addVirtualIncludes(options, key)
            );
        });
        try {
          const ejsOutput = await ejs.renderFile(fullPath, models, {
            async: true
          });
          console.log('EJS output:', ejsOutput);
          setTemplateOutput(ejsOutput);
        } catch (error) {
          setHtmlOutput(
            <div>
              <h1>EJS Templating Error</h1>
              <h3>EJS Input</h3>
              <p>{fullPath}</p>
              <h3>Error Message</h3>
              <p>{error.toString()}</p>
            </div>
          );
        }
      }
    };
    runTemplate();
  }, [fileContents]);

  useEffect(() => {
    console.log('Running HTML generation');
    const runHtmlGeneration = async () => {
      if (!isDocumentSchema(schema)) {
        return;
      }
      if (schema.format === 'markdown') {
        setHtmlOutput(
          <ReactMarkdown source={templateOutput} escapeHtml={false} />
        );
      } else if (schema.format === 'html') {
        setHtmlOutput(
          // eslint-disable-next-line react/no-danger
          <div dangerouslySetInnerHTML={{ __html: templateOutput }} />
        );
      }
    };
    runHtmlGeneration();
  }, [templateOutput]);

  return (
    <div className={classes.root}>
      <div>{htmlOutput}</div>
      <hr />
      {!params.hideBack && (
        <div className={classes.buttons}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              history.goBack();
            }}
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
};

export default connector(withStyles(styles)(ViewDocument));
