import { Sequelize } from 'sequelize';
import elog from 'electron-log';

const log = elog.scope('services/db/SQL');

export const database = new Sequelize('sqlite::memory:', {
  define: {
    charset: 'utf8',
    collate: 'utf8_general_ci'
  },
  logging: (sql: string, _timing: number | undefined): void => log.debug(sql)
});

export default {};
