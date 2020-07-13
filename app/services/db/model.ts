import { Model, Association } from 'sequelize';
import elog from 'electron-log';

import { Schema } from '../../types/schema';
import { database } from './index';

const log = elog.scope('services/db/model');

// Generic association interface that provides:
//  - Generic API applicable to both single and multi associations
//  - Association arity specific APIs that throw an exception if association type is not correct
class AssociationWrapper {
  association: any;

  isMulti: boolean;

  constructor(a: Association) {
    this.association = a;
    if (
      a.associationType === 'BelongsToMany' ||
      a.associationType === 'HasMany'
    ) {
      this.isMulti = true;
    } else if (
      a.associationType === 'BelongsTo' ||
      a.associationType === 'HasOne'
    ) {
      this.isMulti = false;
    } else {
      throw new Error(`Illegal association type ${a.associationType}`);
    }
  }

  async get(instance: Model, options: any = {}): Promise<Array<Model>> {
    if (this.isMulti) {
      return this.association.get(instance, options);
    }
    const result: Model | null = this.association.get(instance, options);
    if (result === null) {
      return [];
    }
    return [result];
  }

  async getOne(instance: Model, options: any = {}): Promise<Model | null> {
    if (this.isMulti) {
      throw new Error('Called getOne for multi-association');
    }
    return this.association.get(instance, options);
  }

  async getAll(instance: Model, options: any = {}): Promise<Array<Model>> {
    if (!this.isMulti) {
      throw new Error('Called getAll for single-association');
    }
    return this.association.get(instance, options);
  }

  // Both null and empty array may be used to remove all associations
  async set(
    instance: Model,
    associatedObjects:
      | Model
      | Model[]
      | string[]
      | string
      | number[]
      | number
      | null,
    options: any = {}
  ): Promise<void> {
    if (
      !this.isMulti &&
      Array.isArray(associatedObjects) &&
      associatedObjects.length > 1
    ) {
      throw new Error(
        'Attempted to set single association to multiple objects'
      );
    }
    if (!this.isMulti && Array.isArray(associatedObjects)) {
      if (associatedObjects.length === 0) {
        return this.association.set(instance, null, options);
      }
      // Length must be one
      return this.association.set(instance, associatedObjects[0], options);
    }
    if (this.isMulti && associatedObjects === null) {
      return this.association.set(instance, [], options);
    }
    return this.association.set(instance, associatedObjects, options);
  }

  async setOne(
    instance: Model,
    associatedObject: Model | string | number | null,
    options: any = {}
  ): Promise<void> {
    if (this.isMulti) {
      throw new Error('Called setOne for multi-association');
    }
    return this.association.set(instance, associatedObject, options);
  }

  async setAll(
    instance: Model,
    associatedObjects: Model[] | string[] | number[],
    options: any = {}
  ): Promise<void> {
    if (!this.isMulti) {
      throw new Error('Called setAll for single-association');
    }
    return this.association.set(instance, associatedObjects, options);
  }

  async count(instance: Model, options: any = {}): Promise<number> {
    if (!this.isMulti) {
      return 1;
    }
    return this.association.count(instance, options);
  }

  async countAll(instance: Model, options: any = {}): Promise<number> {
    if (!this.isMulti) {
      throw new Error('Called countAll for single-association');
    }
    return this.association.count(instance, options);
  }
}

type ModelType = typeof Model;
export interface ModelWithAssociations extends ModelType {
  associationsByName: {
    [name: string]: AssociationWrapper;
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
  m.associationsByName[property] = new AssociationWrapper(association);
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
  log.info(
    `Setting association ${property} for model ${sourceSchema.$id}: ${target}`
  );
  await association.set(sourceInstance, target);
};

export default {};
