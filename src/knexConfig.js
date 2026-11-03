const path = require("path");
const config = require("./cfg");

let knexOptions;
if (config.dbType === "sqlite") {
  const resolvedPath = path.resolve(process.cwd(), config.sqliteOptions.filename);
  console.log(`Using an SQLite database:\n  ${resolvedPath}`);

  knexOptions = {
    client: "sqlite",
    connection: {
      ...config.sqliteOptions,
    },
  };
} else if (config.dbType === "mysql") {
  const host = config.mysqlOptions.host || "localhost";
  const port = config.mysqlOptions.port || 3306;
  const mysqlStr = `${config.mysqlOptions.user}@${host}:${port}/${config.mysqlOptions.database}`;
  console.log(`Using a MySQL database:\n  ${mysqlStr}`);

  knexOptions = {
    client: "mysql2",
    connection: {
      ...config.mysqlOptions,
    },
  };
} else if (config.dbType === "postgres") {
  const host = config.postgresOptions.host || "localhost";
  const port = config.postgresOptions.port || 5432;
  const postgresStr = `${config.postgresOptions.user}@${host}:${port}/${config.postgresOptions.database}`;
  console.log(`Using a PostgreSQL database:\n  ${postgresStr}`);

  knexOptions = {
    client: "pg",
    connection: {
      ...config.postgresOptions,
    },
  };
}

module.exports = {
  ...knexOptions,

  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(__dirname, "data", "migrations"),
  },
  log: {
    warn(message) {
      if (message.startsWith("FS-related option specified for migration configuration")) {
        return;
      }

      if (message === "Connection Error: Error: read ECONNRESET") {
        // Knex automatically handles the reconnection
        return;
      }

      console.warn(`[DATABASE WARNING] ${message}`);
    },
  },
};
