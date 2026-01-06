import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api_error.utils.";
import jwt from "jsonwebtoken";
import { ROLE } from "../global.types";
import { logger } from "../config/logger.config";


export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.headers.authorization?.split(" ")[1];
    logger.info('TOKEN IN BACKEND', token)
    if (!token) {
        throw new ApiError(401, 'Access token is required');
    }
    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as { id: string, email: string, role: ROLE };
        req.user = decoded;
    } catch (error) {
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
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as { id: string, email: string, role: ROLE };
        req.user = decoded;
    } catch (error) {
        logger.warn('Invalid token in optional auth, continuing without user');
    }

    next();
}