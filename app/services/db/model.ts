import { Model, Association } from 'sequelize';
import elog from 'electron-log';

import { Schema } from '../../types/schema';
import { database } from './index';
import { assertIsDefined } from '../../types/util';

const log = elog.scope('services/db/model');

type ModelType = typeof Model;

interface AssociationTemplate {
  get?: Function;
  set?: Function;
  count?: Function;
  add?: Function;
  remove?: Function;
  has?: Function;
}

export interface GenericAssociation {
  association: Association;
  get: Function;
  set: Function;
  isMulti: boolean;
}

export interface SingleAssociation extends GenericAssociation {
  isMulti: false;
}

export interface MultiAssociation extends GenericAssociation {
  count: Function;
  add: Function;
  remove: Function;
  has: Function;
  isMulti: true;
}

export const isMultiAssociation = (
  a: GenericAssociation
): a is MultiAssociation => a.isMulti;

export interface ModelWithAssociations extends ModelType {
  associationsByName: {
    [name: string]: GenericAssociation;
  };
}

export const addAssociation = (
  schemaName: string,
  property: string,
  association: Association
) => {
  const m = database.models[schemaName] as ModelWithAssociations;
  if (!m.associationsByName) {
    m.associationsByName = {};
  }
  if (['HasOne', 'BelongsTo'].includes(association.associationType)) {
    const initialValue: AssociationTemplate = {};
    const template = Object.getOwnPropertyNames(
      Object.getPrototypeOf(association)
    ).reduce<AssociationTemplate>((obj, key) => {
      const a = association as {
        [key: string]: any;
      };
      if (obj && key.startsWith('get') && typeof a[key] === 'function') {
        return {
          ...obj,
          get: a[key]
        };
      }
      if (obj && key.startsWith('set') && typeof a[key] === 'function') {
        return {
          ...obj,
          set: a[key]
        };
      }
      return obj;
    }, initialValue);
    if (!template.get || !template.set) {
      log.info(
        'Single-association missing accessors',
        'Template:',
        template,
        'Association:',
        association
      );
      throw new Error(
        `Missing accessors for association ${property} in schema ${schemaName}`
      );
    }
    assertIsDefined(template.get);
    assertIsDefined(template.set);
    m.associationsByName[property] = {
      association,
      get: template.get,
      set: template.set,
      isMulti: false
    };
  } else if (
    ['HasMany', 'BelongsToMany'].includes(association.associationType)
  ) {
    const initialValue: AssociationTemplate = {};
    const template = Object.getOwnPropertyNames(
      Object.getPrototypeOf(association)
    ).reduce<typeof initialValue>((obj, key) => {
      const a = association as {
        [key: string]: any;
      };
      if (obj && key.startsWith('get') && typeof a[key] === 'function') {
        return {
          ...obj,
          get: a[key]
        };
      }
      if (obj && key.startsWith('set') && typeof a[key] === 'function') {
        return {
          ...obj,
          set: a[key]
        };
      }
      if (obj && key.startsWith('add') && typeof a[key] === 'function') {
        return {
          ...obj,
          add: a[key]
        };
      }
      if (obj && key.startsWith('remove') && typeof a[key] === 'function') {
        return {
          ...obj,
          remove: a[key]
        };
      }
      if (obj && key.startsWith('count') && typeof a[key] === 'function') {
        return {
          ...obj,
          count: a[key]
        };
      }
      if (obj && key.startsWith('has') && typeof a[key] === 'function') {
        return {
          ...obj,
          has: a[key]
        };
      }
      return obj;
    }, initialValue);
    if (
      !template.get ||
      !template.set ||
      !template.add ||
      !template.remove ||
      !template.count ||
      !template.has
    ) {
      log.info(
        'Multi-association missing accessors',
        'Template:',
        template,
        'Association:',
        association
      );
      throw new Error(
        `Missing accessors for association ${property} in schema ${schemaName}`
      );
    }
    assertIsDefined(template.get);
    assertIsDefined(template.set);
    assertIsDefined(template.add);
    assertIsDefined(template.remove);
    assertIsDefined(template.count);
    assertIsDefined(template.has);
    const a: MultiAssociation = {
      association,
      get: template.get,
      set: template.set,
      add: template.add,
      remove: template.remove,
      count: template.count,
      has: template.has,
      isMulti: true
    };
    m.associationsByName[property] = a;
  } else {
    throw new Error(
      `Unknown association type ${association.associationType} for association ${property} in schema ${schemaName}`
    );
  }
};

export const isModelWithAssociations = (
  model: ModelType
): model is ModelWithAssociations => {
  const m = model as ModelWithAssociations;
  return m.associationsByName !== undefined;
};

export const setAssociation = async (
  sourceSchema: Schema,
  sourceInstance: Model,
  property: string,
  target: string | Array<string>
) => {
  const model = database.models[sourceSchema.$id];
  if (!isModelWithAssociations(model)) {
    throw new Error(
      `Internal error: associations missing for model for schema ${sourceSchema.name}`
    );
  }
  const association = model.associationsByName[property];
  if (!association) {
    throw new Error(
      `Internal error: association ${property} missing for model for schema ${sourceSchema.name}`
    );
  }
  await association.set(sourceInstance, target);
};

export default {};
