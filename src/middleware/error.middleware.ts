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

  let statusCode = 500;

  if (message === "Inventory not found") {
    statusCode = 404;
  } else if (
    message === "Inventory reservation not found"
  ) {
    statusCode = 404;
  } else if (
    message === "Insufficient inventory"
  ) {
    statusCode = 409;
  } else if (
    message.includes("already exists")
  ) {
    statusCode = 409;
  } else if (
    message.includes("already been released")
  ) {
    statusCode = 409;
  } else if (
    message.includes(
      "Confirmed inventory cannot be released"
    )
  ) {
    statusCode = 409;
  } else if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("Invalid")
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};