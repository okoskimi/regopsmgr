import { Op } from 'sequelize';
import { Column } from 'material-table';
import elog from 'electron-log';

import { database } from '.';

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

export const loadData = async (
  modelId: string,
  page: number,
  pageSize: number,
  searchTerm: string,
  searchColumns: Array<{ field: string }>,
  orderBy: Column<any>,
  orderDirection: string,
  filters: Array<{ column: Column<any>; value: string }>,
  rawFilter: any
): Promise<LoadResult> => {
  const model = database.models[modelId];
  if (!model) {
    throw new Error(`Model ${model} not found in database`);
  }
  const query: any = {};
  if (searchTerm) {
    query.where = {
      [Op.or]: []
    };
    searchColumns.forEach(column => {
      // Search in all properties accessible to SQL (non-deep ones)
      if (column.field.indexOf('.') < 0) {
        query.where[Op.or].push({
          [column.field]: {
            [Op.like]: `%${searchTerm}%`
          }
        });
      }
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
  const { count, rows } = await model.findAndCountAll(query);
  return {
    data: rows,
    page,
    totalCount: count
  };
};
