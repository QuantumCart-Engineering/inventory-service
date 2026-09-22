import dotenv from "dotenv";

dotenv.config();

const requiredEnv = (name: string): string => {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
};

const positiveIntegerEnv = (
  name: string,
  defaultValue?: number
): number => {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Environment variable ${name} must be a positive integer`
    );
  }

  return parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: positiveIntegerEnv("PORT", 8005),

  db: {
    host: requiredEnv("DB_HOST"),
    port: positiveIntegerEnv("DB_PORT"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    name: requiredEnv("DB_NAME"),
    connectionLimit: positiveIntegerEnv(
      "DB_CONNECTION_LIMIT",
      10
    )
  },

  rabbitmq: {
    host: requiredEnv("RABBITMQ_HOST"),
    port: positiveIntegerEnv(
      "RABBITMQ_PORT",
      5672
    ),
    user: requiredEnv("RABBITMQ_USER"),
    password: requiredEnv("RABBITMQ_PASSWORD"),
    exchange: requiredEnv("RABBITMQ_EXCHANGE")
  }
};