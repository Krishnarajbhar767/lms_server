import asyncHandler from "../utils/async_handler.utils";
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { CreateCategoryDTO } from "../dtos/category.dtos";
import { ApiError } from "../utils/api_error.utils.";
import { cache, clearCacheByPrefix, CATEGORY_CACHE_PREFIX, CATEGORY_ADMIN_CACHE_PREFIX } from "../utils/cache";

const createCategory = asyncHandler(async (req: Request<{}, {}, CreateCategoryDTO>, res: Response) => {
    const { name, description } = req.body;
    const isExistingCategory = await prisma.category.findUnique({ where: { name: name.toLowerCase().trim() } });
    if (isExistingCategory) {
        throw new ApiError(400, 'Category already exists');
    }
    const category = await prisma.category.create({ data: { name: name.toLowerCase().trim(), description } });

    // clear all cache related to categories
    clearCacheByPrefix(cache, CATEGORY_CACHE_PREFIX);
    clearCacheByPrefix(cache, CATEGORY_ADMIN_CACHE_PREFIX);

    res.success("Category created successfully", category, 201);
});

const updateCategory = asyncHandler(async (req: Request<{ id: string }, {}, CreateCategoryDTO>, res: Response) => {
    const id = req.params.id
    const { name, description } = req.body;
    const category = await prisma.category.findUnique({ where: { id: Number(id) } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    const updatedCategory = await prisma.category.update({ where: { id: Number(id) }, data: { name: name.toLowerCase().trim(), description } });

    // clear all cache related to categories
    clearCacheByPrefix(cache, CATEGORY_CACHE_PREFIX);
    clearCacheByPrefix(cache, CATEGORY_ADMIN_CACHE_PREFIX);

    res.success("Category updated successfully", updatedCategory, 200);
})

const deleteCategory = asyncHandler(async (req: Request<{ id: string }, {}, { targetCategoryId?: number }>, res: Response) => {
    const id = Number(req.params.id);
    const { targetCategoryId } = req.body;

    const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { courses: true } } }
    });

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Check if category has courses
    if (category._count.courses > 0) {
        if (!targetCategoryId) {
            throw new ApiError(400, `This category has ${category._count.courses} courses. Please provide a target category to move them to.`);
        }

        // Validate target category
        const targetCategory = await prisma.category.findUnique({ where: { id: targetCategoryId } });
        if (!targetCategory) {
            throw new ApiError(404, 'Target category not found');
        }

        if (targetCategoryId === id) {
            throw new ApiError(400, 'Target category cannot be the same as the deleted category');
        }

        // Move courses to target category
        await prisma.course.updateMany({
            where: { categoryId: id },
            data: { categoryId: targetCategoryId }
        });
    }

    const deletedCategory = await prisma.category.delete({ where: { id } });

    // clear all cache related to categories
    clearCacheByPrefix(cache, CATEGORY_CACHE_PREFIX);
    clearCacheByPrefix(cache, CATEGORY_ADMIN_CACHE_PREFIX);

    res.success("Category deleted successfully", deletedCategory, 200);
})

// Public Endpoint - Only returns categories with courses
const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = `${CATEGORY_CACHE_PREFIX}all`;
    const cachedCategories = await cache.get(cacheKey);

    if (cachedCategories) {
        return res.success('Categories fetched successfully cached', cachedCategories, 200);
    }

    // Only return categories that have at least one PUBLISHED course (public endpoint)
    const categories = await prisma.category.findMany({
        where: {
            courses: {
                some: {
                    status: 'PUBLISHED'
                }
            }
        },
        include: {
            _count: {
                select: {
                    courses: {
                        where: { status: 'PUBLISHED' }
                    }
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    cache.set(cacheKey, categories);
    res.success('Categories fetched successfully uncached', categories, 200);
})

// Admin Endpoint - Returns ALL categories
const getAdminCategories = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = `${CATEGORY_ADMIN_CACHE_PREFIX}all`;
    const cachedCategories = await cache.get(cacheKey);

    if (cachedCategories) {
        return res.success('All categories fetched successfully', cachedCategories, 200);
    }

    const categories = await prisma.category.findMany({
        include: {
            _count: {
                select: { courses: true }
            }
        },
        orderBy: {
            id: 'asc' // Consistent ordering
        }
    });

    cache.set(cacheKey, categories);
    res.success('All categories fetched successfully', categories, 200);
})

const getCategoryById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id
    const cachedCategory = await cache.get(CATEGORY_CACHE_PREFIX + id);
    if (cachedCategory) {
        return res.success('Category fetched successfully', cachedCategory, 200);
    }
    const category = await prisma.category.findUnique({ where: { id: Number(id) }, include: { courses: true } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    // cache category
    cache.set(CATEGORY_CACHE_PREFIX + id, category);
    res.success('Category fetched successfully', category, 200);
})
export {
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategories,
    getAdminCategories,
    getCategoryById
}