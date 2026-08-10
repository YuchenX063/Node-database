module.exports = {
  'development': {
    'username': process.env.DB_USER || 'root',
    'password': process.env.DB_PASSWORD || 'password',
    'database': process.env.DB_NAME || 'almanacs-database',
    'port': process.env.DB_PORT || 3306,
    'host': process.env.DB_HOST || '127.0.0.1',
    'dialect': 'mysql',
    'dialectOptions': {
      // Connection charset only. Column collations are set per-column by the
      // charset migration (utf8mb4_unicode_ci for text, utf8mb4_bin for person
      // ids); `collate` is not a valid mysql2 connection option (it warns and
      // will error in future mysql2 versions), so it is intentionally omitted.
      charset: 'utf8mb4',
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
      // Connection charset only. Column collations are set per-column by the
      // charset migration (utf8mb4_unicode_ci for text, utf8mb4_bin for person
      // ids); `collate` is not a valid mysql2 connection option (it warns and
      // will error in future mysql2 versions), so it is intentionally omitted.
      charset: 'utf8mb4',
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
      // Connection charset only. Column collations are set per-column by the
      // charset migration (utf8mb4_unicode_ci for text, utf8mb4_bin for person
      // ids); `collate` is not a valid mysql2 connection option (it warns and
      // will error in future mysql2 versions), so it is intentionally omitted.
      charset: 'utf8mb4',
    }
  }
};