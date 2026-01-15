import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api_error.utils";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../global.types";
import { logger } from "../config/logger.config";
import { validateSession, updateSessionActivity } from "../services/session.service";
import { prisma } from "../prisma";
import { redis } from "../config/redis.config";

const BLOCK_CACHE_TTL = 60; // 60 seconds cache for block status
const BLOCK_CACHE_PREFIX = "user:blocked:";

// Check if user is blocked with Redis cache
async function isUserBlocked(userId: number): Promise<boolean> {
    const cacheKey = `${BLOCK_CACHE_PREFIX}${userId}`;
    
    // Try cache first
    try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
            return cached === "1";
        }
    } catch {
        // Redis error, fall through to DB
    }
    
    // Cache miss, check DB
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isBlocked: true }
    });
    
    const isBlocked = user?.isBlocked ?? false;
    
    // Cache the result
    try {
        await redis.setex(cacheKey, BLOCK_CACHE_TTL, isBlocked ? "1" : "0");
    } catch {
        // Cache write failed, not critical
    }
    
    return isBlocked;
}

// Invalidate block cache after block/unblock action
export async function invalidateBlockCache(userId: number): Promise<void> {
    try {
        await redis.del(`${BLOCK_CACHE_PREFIX}${userId}`);
    } catch {
        // Cache delete failed, will expire naturally
    }
}

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

        // Check if user is blocked (with cache)
        const blocked = await isUserBlocked(decoded.id);
        if (blocked) {
            throw new ApiError(403, 'Your account has been blocked by the administrator. Please contact support.');
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
        
        // Check if user is blocked (with cache)
        const blocked = await isUserBlocked(decoded.id);
        
        // If blocked, treat as unauthenticated
        if (blocked) {
            return next();
        }
        
        req.user = decoded;
    } catch {
        logger.warn('Invalid token in optional auth, continuing without user');
    }

    next();
}

