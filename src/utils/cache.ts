import { redis } from "../config/redis.config";
import { logger } from "../config/logger.config";

// cache key prefixes
export const COURSE_CACHE_PREFIX = "courses:";
export const COURSE_ADMIN_CACHE_PREFIX = "courses_admin:";
export const CATEGORY_CACHE_PREFIX = "categories:";
export const CATEGORY_ADMIN_CACHE_PREFIX = "categories_admin:";
export const DASHBOARD_CACHE_KEY = "dashboard:analytics";

// get cached data by key
export const getCache = async <T>(key: string): Promise<T | undefined> => {
    try {
        const data = await redis.get(key);
        if (!data) return undefined;
        return JSON.parse(data) as T;
    } catch (error) {
        logger.error("Redis get error", error);
        return undefined;
    }
};

// set cache with optional ttl in seconds default 1 hour
export const setCache = async (key: string, value: any, ttl: number = 3600): Promise<boolean> => {
    try {
        const result = await redis.set(key, JSON.stringify(value), "EX", ttl);
        return result === "OK";
    } catch (error) {
        logger.error("Redis set error", error);
        return false;
    }
};

// delete cache by key
export const deleteCache = async (key: string): Promise<number> => {
    try {
        return await redis.del(key);
    } catch (error) {
        logger.error("Redis delete error", error);
        return 0;
    }
};

// clear all cache keys matching a prefix
export const clearCacheByPrefix = async (prefix: string): Promise<void> => {
    try {
        let cursor = "0";
        do {
            const [newCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
            cursor = newCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");
    } catch (error) {
        logger.error("Redis clear prefix error", error);
    }
};


