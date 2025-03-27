module.exports = {
  'development': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'almanacs-database',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql',
    'dialectOptions': {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    }
  },
  'test': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'database-app',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql',
    'dialectOptions': {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    }
  },
  'production': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'almanacs-app',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql',
    'dialectOptions': {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    }
  }
};