import { Sequelize } from 'sequelize';

export const database = new Sequelize('sqlite::memory:', {
  define: {
    charset: 'utf8',
    collate: 'utf8_general_ci'
  }
});

export default {};
