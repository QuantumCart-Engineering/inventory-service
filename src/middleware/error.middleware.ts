import {
  Request,
  Response,
  NextFunction
} from "express";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(error);

  const message =
    error instanceof Error
      ? error.message
      : "Internal server error";

  const statusCode =
    message.includes("already exists")
      ? 409
      : message.includes("required") ||
          message.includes("must be")
        ? 400
        : 500;

  res.status(statusCode).json({
    success: false,
    message
  });
};