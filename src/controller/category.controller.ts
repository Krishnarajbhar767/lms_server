import asyncHandler from "../utils/async_handler.utils";
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { CreateCategoryDTO } from "../dtos/category.dtos";
import { ApiError } from "../utils/api_error.utils.";
import { cache, CATEGORY_CACHE_PREFIX } from "../utils/cache";

const createCategory = asyncHandler(async (req: Request<{}, {}, CreateCategoryDTO>, res: Response) => {
    const { name, description } = req.body;
    const isExistingCategory = await prisma.category.findUnique({ where: { name: name.toLowerCase().trim() } });
    if (isExistingCategory) {
        throw new ApiError(400, 'Category already exists');
    }
    await prisma.category.create({ data: { name: name.toLowerCase().trim(), description } });
    // clear cache
    cache.del(CATEGORY_CACHE_PREFIX);
    res.success("Category created successfully", 201);
});

const updateCategory = asyncHandler(async (req: Request<{ id: string }, {}, CreateCategoryDTO>, res: Response) => {
    const id = req.params.id
    const { name, description } = req.body;
    const category = await prisma.category.findUnique({ where: { id: Number(id) } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    const updatedCategory = await prisma.category.update({ where: { id: Number(id) }, data: { name: name.toLowerCase().trim(), description } });
    // clear cache
    cache.del(CATEGORY_CACHE_PREFIX + id);
    res.success("Category updated successfully", updatedCategory, 200);
})

const deleteCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id
    const category = await prisma.category.findUnique({ where: { id: Number(id) } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    const deletedCategory = await prisma.category.delete({ where: { id: Number(id) } });
    // clear cache
    cache.del(CATEGORY_CACHE_PREFIX + id);
    cache.del(CATEGORY_CACHE_PREFIX);
    res.success("Category deleted successfully", deletedCategory, 200);
})

const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
    const cachedCategories = await cache.get(CATEGORY_CACHE_PREFIX);
    if (cachedCategories) {
        return res.success('Categories fetched successfully', cachedCategories, 200);
    }
    // find all categories
    const categories = await prisma.category.findMany();
    // cache all categories
    cache.set(CATEGORY_CACHE_PREFIX, categories);
    res.success('Categories fetched successfully', categories, 200);
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
    getCategoryById
}