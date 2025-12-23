import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../utils/api_error.utils.';


export function routeNotFound(req: Request, res: Response, next: NextFunction) {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
}