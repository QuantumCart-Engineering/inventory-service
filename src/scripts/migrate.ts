import fs from "fs";
import path from "path";

import { pool } from "../database/mysql";

const migrationsDirectory = path.join(
  process.cwd(),
  "migrations"
);

const runMigrations = async (): Promise<void> => {
  let connection;

  try {
    connection = await pool.getConnection();

    console.log("Connected to MySQL database.");

    const migrationFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const file of migrationFiles) {
      const filePath = path.join(
        migrationsDirectory,
        file
      );

      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`Running migration: ${file}`);

      await connection.query(sql);

      console.log(`Migration completed: ${file}`);
    }

    console.log("All migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    connection?.release();
    await pool.end();
  }
};

runMigrations();