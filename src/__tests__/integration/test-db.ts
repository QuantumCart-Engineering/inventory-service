import mysql, {
  PoolConnection
} from "mysql2/promise";

import { pool } from "../../database/mysql";

const database = process.env.DB_NAME;

if (!database) {
  throw new Error(
    "DB_NAME is required for integration tests"
  );
}

export const testDb = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 0,
  multipleStatements: true
});

export const cleanDatabase =
  async (): Promise<void> => {
    const connection: PoolConnection =
      await testDb.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        "SET FOREIGN_KEY_CHECKS = 0"
      );

      await connection.query(
        "TRUNCATE TABLE outbox_events"
      );

      await connection.query(
        "TRUNCATE TABLE inventory_reservations"
      );

      await connection.query(
        "TRUNCATE TABLE inventory"
      );

      await connection.query(
        "SET FOREIGN_KEY_CHECKS = 1"
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

export const closeTestDatabase =
  async (): Promise<void> => {
    await testDb.end();

    await pool.end();
  };