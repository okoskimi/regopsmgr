import { promises as fsp } from 'fs';
import YAML from 'yaml';
import { Scalar } from 'yaml/types';
import { v4 as uuidv4 } from 'uuid';
import elog from 'electron-log';

import { assertIsDefined } from '../types/util';
import { validateType, validateSchema } from '../types/validation';
import { markAsChanged } from './files';

const log = elog.scope('services/yaml');

interface Node extends YAML.AST.Node {
  _comment_already_used_: boolean;
}

const isScalar = (node: any): node is Scalar => {
  return node instanceof Scalar;
};

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

export interface Comments {
  [value: string]: {
    comment: string;
    force: boolean;
  };
}

const copyComments = (
  fromDoc: YAML.Document,
  toDoc: YAML.Document,
  addComments?: Comments
) => {
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
  log.debug('Comments:', comments);
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
    } else if (isScalar(node)) {
      // Additional comments are only added if there is no pre-existing comment
      if (addComments) {
        const comment = addComments[node.value.toString()];
        if (comment && (comment.force || !node.comment)) {
          // eslint-disable-next-line no-param-reassign
          node.comment = ` ${comment.comment}`;
        }
      }
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

interface SaveYamlFileOptions {
  markAsChanged?: boolean;
  comments?: Comments;
}

export const saveYamlFile = async (
  fullPath: string,
  modifiedObj: any,
  options: SaveYamlFileOptions = {}
) => {
  let fileContents = null;
  try {
    fileContents = await fsp.readFile(fullPath, 'utf8');
  } catch (error) {
    log.error('Error loading old data', error);
  }
  if (fileContents) {
    const doc = YAML.parseDocument(fileContents);
    const modifiedDoc = YAML.parseDocument(YAML.stringify(modifiedObj));
    copyComments(doc, modifiedDoc, options.comments);
    if (options.markAsChanged) {
      markAsChanged(fullPath);
    }
    await fsp.writeFile(fullPath, modifiedDoc.toString());
  } else {
    if (options.markAsChanged) {
      markAsChanged(fullPath);
    }
    await fsp.writeFile(fullPath, YAML.stringify(modifiedObj));
  }
};

interface LoadYamlFileOptions {
  schemaId?: string;
  schema?: object;
  forceId?: boolean;
  markAsChanged?: boolean;
}

export const loadYamlFile = async (
  fullPath: string,
  options: LoadYamlFileOptions = {}
): Promise<any> => {
  const contentStr = await fsp.readFile(fullPath, { encoding: 'utf8' });
  const contentObj = YAML.parse(contentStr);
  if (options.forceId && !contentObj.id) {
    // Force ID to be first property so that it is first in YAML file
    const yamlData = {
      id: uuidv4(),
      ...contentObj
    };
    log.info('Saving ID to ', fullPath);
    await saveYamlFile(fullPath, yamlData, {
      markAsChanged: !!options.markAsChanged
    });
    contentObj.id = yamlData.id;
  }
  if (options.schemaId) {
    const [success, errors] = validateType(options.schemaId, contentObj);
    if (!success) {
      log.error('Could not validate:', contentObj);
      throw new Error(
        `Failed schema validation for schema ${fullPath}: ${JSON.stringify(
          errors
        )}`
      );
    }
  } else if (options.schema) {
    const [success, errors] = validateSchema(options.schema, contentObj);
    if (!success) {
      log.error('Could not validate:', contentObj);
      throw new Error(
        `Failed schema validation for ${fullPath}: ${JSON.stringify(errors)}`
      );
    }
  }
  return contentObj;
};
