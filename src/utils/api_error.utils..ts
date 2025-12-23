
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends ApiError {
  constructor(message = 'Validation Error') {
    super(400, message);
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class PermissionError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource Not Found') {
    super(404, message);
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal Server Error') {
    super(500, message, false); // unexpected
  }
}