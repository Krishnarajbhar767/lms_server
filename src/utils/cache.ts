import NodeCache from "node-cache";

export const cache = new NodeCache();

export const COURSE_CACHE_PREFIX = "courses:";
export const COURSE_ADMIN_CACHE_PREFIX = "courses_admin:";
export const CATEGORY_CACHE_PREFIX = "categories:";
export const CATEGORY_ADMIN_CACHE_PREFIX = "categories_admin:";
export const USER_CACHE_PREFIX = "users:";

export const clearCacheByPrefix = (cache: NodeCache, prefix: string) => {
    const keys = cache.keys();
    keys.forEach((key) => {
        if (key.startsWith(prefix)) {
            cache.del(key);
        }
    });
};
