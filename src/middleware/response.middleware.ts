import { Request, Response, NextFunction } from 'express';

export function responseHandler(req: Request, res: Response, next: NextFunction) {
  res.success = function <T>(message: string, data: T, statusCode = 200): void {
    this.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
    });
  };
  next();
}