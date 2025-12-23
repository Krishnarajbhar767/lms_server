import 'express';
// ROLE 
export type ROLE = "ADMIN" | "STUDENT"


declare module 'express-serve-static-core' {
  interface Response {
    success: <T>(message: string, data?: T, statusCode?: number) => void;
  }
}


declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: ROLE
      };
    }
  }
}

