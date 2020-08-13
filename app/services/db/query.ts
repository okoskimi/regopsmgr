import { Op, Model } from 'sequelize';
import { Column } from 'material-table';
import elog from 'electron-log';

import { database } from '.';
import { isModelWithAssociations } from './model';
import {
  AssociationDataMap,
  ObjectSchema,
  IncludeEntry
} from '../../types/schema';

const log = elog.scope('services/db/query');

export const convertFilter = (filter: any): any => {
  if (Array.isArray(filter)) {
    return filter.map(item => convertFilter(item));
  }
  if (typeof filter === 'object' && !(filter instanceof String)) {
    // Circumvent Typescript prohibition for indexing Op
    const OpAny: any = Op;
    const rval: any = {};
    Object.keys(filter).forEach(key => {
      if (typeof key === 'string' && key.startsWith('Op.')) {
        const opName = key.substring(3);
        if (OpAny[opName]) {
          rval[OpAny[opName]] = convertFilter(filter[key]);
        } else {
          throw new Error(`Unknown operation ${key} in filter`);
        }
      } else {
        rval[key] = convertFilter(filter[key]);
      }
    });
    return rval;
  }
  return filter;
};

export interface LoadResult {
  data: Array<any>;
  page: number;
  totalCount: number;
}

export const loadObject = async (
  schema: ObjectSchema,
  id: string
): Promise<Model | null> => {
  const model = database.models[schema.$id];
  if (!model) {
    throw new Error(`Model ${model} not found in database`);
  }
  return model.findByPk(id, {
    include: schema.virtualIncludes
  });
};

const buildQuery = (
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumns?: Array<{ field: string }>,
  orderBy?: Column<any>,
  orderDirection?: string,
  filters?: Array<{ column: Column<any>; value: string }>,
  rawFilter?: any,
  includes?: Array<IncludeEntry>
) => {
  const query: any = {};
  if (searchTerm && searchColumns) {
    query.where = {
      [Op.or]: []
    };
    searchColumns.forEach(column => {
      query.where[Op.or].push({
        [column.field]: {
          [Op.like]: `%${searchTerm}%`
        }
      });
    });
  }
  if (filters && filters.length > 0) {
    query.where = {
      [Op.and]: query.where ? [query.where] : []
    };
    filters.forEach(filter => {
      if (
        filter.column.field &&
        typeof filter.column.field === 'string' &&
        filter.column.field.indexOf('.') < 0
      ) {
        query.where[Op.and].push({
          [filter.column.field]: {
            [Op.like]: `%${filter.value}%`
          }
        });
      }
    });
  }
  if (rawFilter) {
    query.where = query.where
      ? {
          [Op.and]: [query.where, rawFilter]
        }
      : rawFilter;
  }
  if (includes) {
    query.include = includes;
  }
  query.limit = pageSize;
  query.offset = page * pageSize;
  if (orderBy && orderBy.field) {
    if (orderDirection) {
      if (orderDirection.toLowerCase().startsWith('asc')) {
        query.order = [[orderBy.field, 'ASC']];
        // Logging does not happen for some reason although code works (?!)
        log.info(`Sorting ${String(orderBy.field)} in ASC order`);
      } else if (orderDirection.toLowerCase().startsWith('desc')) {
        query.order = [[orderBy.field, 'DESC']];
        log.info(`Sorting ${String(orderBy.field)} in DESC order`);
      } else {
        throw new Error(`Unknown order direction ${orderDirection}`);
      }
    } else {
      query.order = [[orderBy.field]];
      log.info(`Sorting ${String(orderBy.field)} in default order`);
    }
  }
  return query;
};

/*
 * Load data from database to table.
 * searchColumns must contain only column names found in the table
 * (i.e. not virtual or nested fields) - this must be checked by caller
 * before calling the function if the field specification is dynamic.
 */

export const loadData = async (
  modelId: string,
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumns?: Array<{ field: string }>,
  orderBy?: Column<any>,
  orderDirection?: string,
  filters?: Array<{ column: Column<any>; value: string }>,
  rawFilter?: any,
  includes?: Array<IncludeEntry>
): Promise<LoadResult> => {
  const model = database.models[modelId];
  if (!model) {
    throw new Error(`Model ${model} not found in database`);
  }
  const query = buildQuery(
    page,
    pageSize,
    searchTerm,
    searchColumns,
    orderBy,
    orderDirection,
    filters,
    rawFilter,
    includes
  );
  const { count, rows } = await model.findAndCountAll(query);
  return {
    data: rows,
    page,
    totalCount: count
  };
};

export interface ModelMap {
  [id: string]: Model;
}

export const loadAssociationMap = async (
  dataMap: AssociationDataMap
): Promise<ModelMap> => {
  const promises: Array<Promise<Array<Model>>> = [];
  Object.keys(dataMap).forEach(associationName => {
    const { modelId, instances } = dataMap[associationName];
    if (instances.length > 0) {
      const model = database.models[modelId];
      promises.push(model.findAll({ where: { id: instances } }));
    }
  });
  const result: ModelMap = {};
  const findResults = await Promise.all(promises);
  findResults.forEach(findResult => {
    findResult.forEach((instance: any) => {
      result[instance.id] = instance;
    });
  });
  return result;
};

export const loadAssociations = async (
  modelId: string,
  instance: Model,
  associationName: string,
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumns?: Array<{ field: string }>,
  orderBy?: Column<any>,
  orderDirection?: string,
  filters?: Array<{ column: Column<any>; value: string }>,
  rawFilter?: any,
  includes?: Array<IncludeEntry>
): Promise<LoadResult> => {
  const model = database.models[modelId];
  if (!model) {
    throw new Error(`Model ${modelId} not found in database`);
  }
  if (!isModelWithAssociations(model)) {
    throw new Error(`Model ${modelId} does not have associations`);
  }
  const association = model.associationsByName[associationName];
  if (!association) {
    throw new Error(
      `Model ${modelId} does not have an association named ${associationName}`
    );
  }
  console.log('Querying association:', association);
  console.log('For model:', model);
  console.log('For instance:', instance);
  const query = buildQuery(
    page,
    pageSize,
    searchTerm,
    searchColumns,
    orderBy,
    orderDirection,
    filters,
    rawFilter,
    includes
  );

  const count = await association.count(instance, query);
  const rows = await association.get(instance, query);
  return {
    data: rows,
    page,
    totalCount: count
  };
};
