import fs, { promises as fsp } from 'fs';
import pathlib from 'path';
import git, { ReadCommitResult } from 'isomorphic-git';
import YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import elog from 'electron-log';

import { database, setAssociation } from './database';
import { validate } from './config';
import { assertIsDefined } from '../types/util';
import { FileEntry } from '../types/file';
import { ObjectSchema, defaultSchema } from '../types/schema';

const log = elog.scope('services/files');

const copyComments = (fromDoc: YAML.Document, toDoc: YAML.Document) => {
  assertIsDefined(fromDoc.contents);
  assertIsDefined(toDoc.contents);

  // Generate property ordering-independent JSON-ish signature
  const generateSignature = (value: any) => {
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      let rval = '[';
      for (let i = 0; i < value.length; i++) {
        rval += generateSignature(value[i]);
        if (i < value.length - 1) {
          rval += ',';
        }
      }
      rval += ']';
      return rval;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort();
      let rval = '{';
      for (let i = 0; i < keys.length; i++) {
        rval += `"${keys[i]}":${generateSignature(value[keys[i]])}`;
        if (i < keys.length - 1) {
          rval += ',';
        }
      }
      rval += '}';
      return rval;
    }
    // Ignore any other types
    return '';
  };

  interface Node extends YAML.AST.Node {
    _comment_already_used_: boolean;
  }

  interface Pair extends YAML.AST.Node {
    key: YAML.AST.ScalarNode;
    value: YAML.AST.Node;
  }

  const isPair = (node: any): node is Pair => {
    return node.type === 'PAIR';
  };

  interface Map extends YAML.AST.Node {
    items: Array<Pair>;
  }

  interface Sequence extends YAML.AST.Node {
    items: Array<YAML.AST.Node>;
  }

  const isMap = (node: any): node is Map => {
    return node.type === 'FLOW_MAP' || node.type === 'MAP';
  };

  const isSequence = (node: any): node is Sequence => {
    return node.type === 'FLOW_SEQ' || node.type === 'SEQ';
  };

  // Make dollar into an escape character:
  //   "$$" - regular dollar
  //   "$/" - path separator
  //   "$k" - key
  //   "$v" - value
  //   "$i" - index
  //   "$j" - JSON-ish signature
  // This ensures keys with dollar characters cannot generate same path string as another path.
  // Dollars in YAML strings must be doubled up.
  // Callback gets node and path as parameters.
  const walk = (
    node: YAML.AST.Node,
    path: string,
    callback: (node: YAML.AST.Node, path: string) => void
  ) => {
    callback(node, path);
    let keyPath = '';
    let valuePath = '';
    if (isPair(node)) {
      keyPath = `${path}$k`;
      walk(node.key, keyPath, callback);
      valuePath = `${path}$v`;
      walk(node.value, valuePath, callback);
    } else if (isMap(node)) {
      node.items.forEach(item => {
        const keyValue = item.key.value.replace('$', '$$');
        const pairPath = `${path}$/${keyValue}`;
        walk(item, pairPath, callback);
      });
    } else if (isSequence(node)) {
      // Match sequence items primarily by JSON-ish signature and secondarily by index
      // However there is no point in recursing for JSON-ish signature since any nested changes
      // will change the signature. Simultaneous index change and content change will
      // cause comments to be lost.
      // Note that we have to do all signature paths first so that we never use an index
      // path if there is a valid signature path.
      node.items.forEach(item => {
        // Note: Using string.replace does not work when you try to double up a character
        const jsonPath = `${path}$j${generateSignature(item.toJSON())
          .split('$')
          .join('$$')}`;
        callback(item, jsonPath);
      });
      node.items.forEach((item, index) => {
        const indexPath = `${path}$i${index}`;
        walk(item, indexPath, callback);
      });
    }
  };

  const comments: { [path: string]: Node } = {};
  // Copy
  walk(fromDoc.contents, 'doc', (node, path) => {
    if (
      node.hasOwnProperty('comment') ||
      node.hasOwnProperty('commentBefore') ||
      node.hasOwnProperty('spaceBefore')
    ) {
      comments[path] = node as Node;
    }
  });
  log.info('Comments:', comments);
  // Paste
  walk(toDoc.contents, 'doc', (node, path) => {
    // Need to ensure comment is only used once since sequence nodes appear both under JSON and index
    if (comments[path] && !comments[path]._comment_already_used_) {
      // eslint-disable-next-line no-param-reassign
      node.comment = comments[path].comment;
      // eslint-disable-next-line no-param-reassign
      node.commentBefore = comments[path].commentBefore;
      // eslint-disable-next-line no-param-reassign
      node.spaceBefore = comments[path].spaceBefore;
      comments[path]._comment_already_used_ = true;
    }
  });
  // eslint-disable-next-line no-param-reassign
  toDoc.comment = fromDoc.comment;
  // eslint-disable-next-line no-param-reassign
  toDoc.commentBefore = fromDoc.commentBefore;
};

// Note: ordering of properties in modifiedObj determines order of properties in the resulting file
// If you want to preserve original ordering, parse first original file and do a lodash.merge
// to copy the modified object properties to the parsed object. That will ensure parsed object
// property ordering overrides the modified object property ordering.
// Although this can be done outside of this function, it is more efficient to obtain
// the parsed object by doing doc.toJSON(), i.e.
// modifiedObjWithOriginalOrder = lodash.merge(doc.toJSON(), modifiedObj)
const saveYamlFile = async (filepath: string, modifiedObj: any) => {
  let fileContents = null;
  try {
    fileContents = await fsp.readFile(filepath, 'utf8');
  } catch (error) {
    log.error('Error loading old data', error);
  }
  if (fileContents) {
    const doc = YAML.parseDocument(fileContents);
    const modifiedDoc = YAML.parseDocument(YAML.stringify(modifiedObj));
    copyComments(doc, modifiedDoc);
    await fsp.writeFile(filepath, modifiedDoc.toString());
  } else {
    await fsp.writeFile(filepath, YAML.stringify(modifiedObj));
  }
};

interface GitStatus {
  modified: number;
  created: number;
  inGit: boolean;
  uncommittedChanges: boolean;
}

const adjustStatusTimestamps = (
  status: GitStatus,
  commit: ReadCommitResult
) => {
  const commitTimestamp = commit.commit.committer.timestamp * 1000;
  if (status.modified < 0 || status.modified < commitTimestamp) {
    // eslint-disable-next-line no-param-reassign
    status.modified = commitTimestamp;
  }
  if (status.created < 0 || status.created > commitTimestamp) {
    // eslint-disable-next-line no-param-reassign
    status.created = commitTimestamp;
  }
};

//  Get git status, including created and modified timestamps.
const getGitStatus = async (
  path: string,
  gitDir: string
): Promise<GitStatus> => {
  log.info(`Looking for timestamps of ${path} at ${gitDir}`);
  const commits = await git.log({ fs, dir: gitDir });
  let lastSHA = null;
  let lastCommit = null;
  const statusResult = {
    modified: -1,
    created: -1,
    inGit: true,
    uncommittedChanges: false
  };
  for (let i = 0; i < commits.length; i += 1) {
    const commit = commits[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      const o = await git.readObject({
        fs,
        dir: gitDir,
        oid: commit.oid,
        filepath: path
      });
      log.info(
        `Found file in git commit at ${new Date(
          commit.commit.committer.timestamp * 1000
        )}`
      );
      if (i === commits.length - 1) {
        // file already existed in first commit
        adjustStatusTimestamps(statusResult, commit);
        break;
      }
      if (o.oid !== lastSHA) {
        if (lastCommit !== null) {
          adjustStatusTimestamps(statusResult, lastCommit);
        }
        lastSHA = o.oid;
      }
    } catch (err) {
      // File no longer there, or wasn't in git at all
      // If not in git at all, then lastCommit is null
      if (lastCommit != null) {
        adjustStatusTimestamps(statusResult, lastCommit);
      }
      break;
    }
    lastCommit = commit;
  }
  // File is not in git
  if (statusResult.modified < 0) {
    log.info('No commits found');
    const stat = await fsp.stat(pathlib.join(gitDir, path));
    return {
      modified: stat.mtimeMs,
      created: stat.birthtimeMs,
      inGit: false,
      uncommittedChanges: true // The existence of the file is an uncommitted change
    };
  }
  const status = await git.status({ fs, dir: gitDir, filepath: path });
  // File has not been modified since checkout
  if (status !== 'unmodified') {
    log.info('File has been modified since checkout');
    statusResult.uncommittedChanges = true;
    const stat = await fsp.stat(pathlib.join(gitDir, path));
    statusResult.modified = stat.mtimeMs;
  }
  return statusResult;
};

export const loadObjectFileToDatabase = async (
  path: string,
  gitDir: string,
  schema: ObjectSchema
): Promise<FileEntry> => {
  const fullPath = pathlib.join(gitDir, path);
  log.info(`Loading file ${path} of type ${schema.name}`);
  const contentStr = await fsp.readFile(fullPath, { encoding: 'utf8' });
  const contentObj = YAML.parse(contentStr);
  if (!contentObj.id) {
    // Force ID to be first property so that it is first in YAML file
    const yamlData = {
      id: uuidv4(),
      ...contentObj
    };
    log.info('Saving ID to ', path);
    await saveYamlFile(fullPath, yamlData);
    contentObj.id = yamlData.id;
  }

  const jsonObj = { ...contentObj };
  const [success, errors] = validate(schema.$id, contentObj);
  if (!success) {
    log.error('Could not validate:', contentObj);
    throw new Error(
      `${path} failed schema validation for ${
        schema.name
      } file ${path}: ${JSON.stringify(errors)}`
    );
  }
  const associations: { [x: string]: string | Array<string> } = {};
  Object.keys(contentObj).forEach(key => {
    if (schema.properties[key]) {
      const { type } = schema.properties[key];
      if (type === 'association') {
        associations[key] = contentObj[key];
        delete contentObj[key];
      } else if (type === 'array' || type === 'object') {
        delete contentObj[key];
      }
    } else {
      throw new Error(
        `Undefined schema property ${key} for ${path} on schema ${schema.name}`
      );
    }
  });
  const gitStatus = await getGitStatus(path, gitDir);
  contentObj._data = jsonObj;
  contentObj.created = new Date(gitStatus.created);
  contentObj.modified = new Date(gitStatus.modified);
  const associationPromises: Array<Promise<void>> = [];
  const model = database.models[schema.name];
  if (!model) {
    throw new Error(
      `Database not properly initialized, model ${schema.name} missing`
    );
  }
  const instance = await model.create(contentObj);
  for (const key of Object.keys(associations)) {
    const association = associations[key];
    associationPromises.push(
      setAssociation(schema, instance, key, association)
    );
  }
  await Promise.all(associationPromises);
  const [dump] = await database.query('SELECT * FROM Risks');
  log.info('Database contents:', dump);

  return {
    path,
    id: `uuid:${contentObj.id}`,
    shortId: contentObj.shortId,
    name: contentObj.name,
    description: contentObj.description
      ? contentObj.description
      : `${schema.name} file ${path}`,
    created: contentObj.created,
    modified: contentObj.modified,
    uncommittedChanges: gitStatus.uncommittedChanges,
    content: contentObj,
    schema
  };
};

export const loadOtherFile = async (
  path: string,
  gitDir: string
): Promise<FileEntry> => {
  log.info(`Loading other file ${path}`);
  const gitStatus = await getGitStatus(path, gitDir);
  return {
    path,
    id: `file:${path}`,
    shortId: path,
    name: pathlib.basename(path),
    description: `${defaultSchema.name} file ${path}`,
    created: new Date(gitStatus.created),
    modified: new Date(gitStatus.modified),
    uncommittedChanges: gitStatus.uncommittedChanges,
    schema: defaultSchema
  };
};

export default {};
