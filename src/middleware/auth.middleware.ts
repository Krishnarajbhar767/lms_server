import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api_error.utils";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../global.types";
import { logger } from "../config/logger.config";
import { validateSession, updateSessionActivity } from "../services/session.service";


export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.headers.authorization?.split(" ")[1];
    if (!token) {
        throw new ApiError(401, 'Access token is required');
    }
    let decoded: JWTPayload;
    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as JWTPayload;

        // Validate session if present
        if (decoded.sessionId) {
            const isValid = await validateSession(decoded.sessionId);
            if (!isValid) {
                throw new ApiError(401, 'Session expired, please login again');
            }
            
            // Update session activity timestamp
            updateSessionActivity(decoded.sessionId).catch(() => {});
        }

        req.user = decoded;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, 'Invalid access token');
    }
    next();
}

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, 'User not found');
    }
    if (user.role !== "ADMIN") {
        throw new ApiError(401, 'Admin access required');
    }
    next();
}

export const isStudent = async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, 'User not found');
    }
    if (user.role !== "STUDENT") {
        throw new ApiError(401, 'Student access required');
    }
    next();
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.headers.authorization?.split(" ")[1];

    // No token? That's fine, continue without user
    if (!token) {
        return next();
    }

    // Try to decode token
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as JWTPayload;
        req.user = decoded;
    } catch (error) {
        logger.warn('Invalid token in optional auth, continuing without user');
    }

    next();
}
