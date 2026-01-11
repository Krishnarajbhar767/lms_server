import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError } from '../utils/api_error.utils';
import { logger } from '../config/logger.config';



export const validate = (schema: any) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    logger.info('ZOD Validation Errors ==>', err);
    if (err instanceof ZodError) {
      const formattedErrors = err.issues.map((e) => ({
        field: e.path[0],
        message: e.message,
      }));
      throw new ValidationError(formattedErrors[0]?.message);
    }
    next(err); // Pass Error For Internal Server Error
  }
};
