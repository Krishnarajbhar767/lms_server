import 'express';

export type ROLE = "ADMIN" | "STUDENT"

/** JWT payload for access and refresh tokens */
export interface JWTPayload {
  id: number;
  email: string;
  role: ROLE;
  sessionId?: string;
}

/** JWT payload for email verification tokens */
export interface EmailVerificationPayload {
  email: string;
}

/** JWT payload for forgot password tokens */
export interface ForgotPasswordPayload {
  id: number;
  email: string;
  role: ROLE;
}


declare module 'express-serve-static-core' {
  interface Response {
    success: <T>(message: string, data?: T, statusCode?: number) => void;
  }
}


declare global {
  namespace Express {
    interface Request {
      user: JWTPayload;
    }
  }
}
