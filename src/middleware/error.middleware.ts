
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api_error.utils';

export function globalErrorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  const message =
    err instanceof ApiError && err.isOperational ? err.message : 'Internal Server Error';

  // Developer logs
  console.error('ERROR ', {
    message: err.message,
    stack: err.stack,
  });

  // Client response
  res.status(status).json({
    success: false,
    message,
    data: null,
  });
}
