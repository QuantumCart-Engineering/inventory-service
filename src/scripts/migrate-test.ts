import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(
    process.cwd(),
    ".env.test"
  )
});

const requiredEnv = (
  name: string
): string => {
  const value = process.env[name];

  if (
    value === undefined ||
    value.trim() === ""
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
};

const host = requiredEnv("DB_HOST");

const port = Number(
  requiredEnv("DB_PORT")
);

const dbUser = requiredEnv("DB_USER");
const dbPassword =
  requiredEnv("DB_PASSWORD");

const database = requiredEnv("DB_NAME");

const rootPassword =
  requiredEnv("MYSQL_ROOT_PASSWORD");

const migrationsDirectory =
  path.resolve(
    process.cwd(),
    "migrations"
  );

const run = async (): Promise<void> => {
  let rootConnection:
    mysql.Connection | null = null;

  let dbConnection:
    mysql.Connection | null = null;

  try {
    /*
     * Step 1:
     * Connect using MySQL root user.
     *
     * This connection is only used for
     * test database bootstrap and permissions.
     */
    rootConnection =
      await mysql.createConnection({
        host,
        port,
        user: "root",
        password: rootPassword,
        multipleStatements: true
      });

    /*
     * Step 2:
     * Create test database if it does not exist.
     */
    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\``
    );

    console.log(
      `Test database ensured: ${database}`
    );

    /*
     * Step 3:
     * Grant the application test user access
     * only to the test database.
     */
    await rootConnection.query(
      `GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${dbUser}'@'%'`
    );

    console.log(
      `Database privileges ensured for user: ${dbUser}`
    );

    /*
     * Step 4:
     * Connect using the same application user
     * that integration tests will use.
     */
    dbConnection =
      await mysql.createConnection({
        host,
        port,
        user: dbUser,
        password: dbPassword,
        database,
        multipleStatements: true
      });

    /*
     * Step 5:
     * Read migrations in sorted order.
     */
    const migrationFiles =
      fs
        .readdirSync(
          migrationsDirectory
        )
        .filter((file) =>
          file.endsWith(".sql")
        )
        .sort();

    if (migrationFiles.length === 0) {
      throw new Error(
        "No migration files found"
      );
    }

    /*
     * Step 6:
     * Run every migration.
     */
    for (const file of migrationFiles) {
      const filePath =
        path.join(
          migrationsDirectory,
          file
        );

      const sql =
        fs.readFileSync(
          filePath,
          "utf8"
        );

      console.log(
        `Running migration: ${file}`
      );

      await dbConnection.query(sql);

      console.log(
        `Migration completed: ${file}`
      );
    }

    console.log(
      "Test database migration completed successfully."
    );
  } catch (error) {
    console.error(
      "Test database migration failed:",
      error
    );

    process.exitCode = 1;
  } finally {
    await dbConnection?.end();
    await rootConnection?.end();
  }
};

run();