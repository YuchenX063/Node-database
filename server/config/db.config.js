module.exports = {
    HOST: process.env.DB_HOST || 'localhost',
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || '123456',
    DB: process.env.DB_NAME || 'almanacs-database',
    port: process.env.DB_PORT || '3307',
    dialect: 'mysql',
    pool: {
      max: 500,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    JWT_SECRET: process.env.JWT_SECRET || 'secret',
    OWNER_USERNAME: process.env.OWNER_USERNAME || 'database-owner',
    OWNER_PASSWORD: process.env.OWNER_PASSWORD || 'password',
    OWNER_EMAIL: process.env.OWNER_EMAIL || 'sample@email.com'
  };