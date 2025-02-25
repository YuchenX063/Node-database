module.exports = {
  'development': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'almanacs-database',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql'
  },
  'test': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'database-app',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql'
  },
  'production': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'almanacs-app',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql'
  }
};