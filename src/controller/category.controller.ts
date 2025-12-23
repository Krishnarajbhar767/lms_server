import asyncHandler from "../utils/async_handler.utils";
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { CreateCategoryDTO } from "../dtos/category.dtos";
import { ApiError } from "../utils/api_error.utils.";

const createCategory = asyncHandler(async (req: Request<{}, {}, CreateCategoryDTO>, res: Response) => {
    const { name, description } = req.body;
    const isExistingCategory = await prisma.category.findUnique({ where: { name: name.toLowerCase().trim() } });
    if (isExistingCategory) {
        throw new ApiError(400, 'Category already exists');
    }
    await prisma.category.create({ data: { name: name.toLowerCase().trim(), description } });
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
    res.success("Category updated successfully", updatedCategory, 200);
})

const deleteCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id
    const category = await prisma.category.findUnique({ where: { id: Number(id) } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    const deletedCategory = await prisma.category.delete({ where: { id: Number(id) } });
    res.success("Category deleted successfully", deletedCategory, 200);
})

const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await prisma.category.findMany();
    res.success('Categories fetched successfully', categories, 200);
})

const getCategoryById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id
    const category = await prisma.category.findUnique({ where: { id: Number(id) }, include: { courses: true } });
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }
    res.success('Category fetched successfully', category, 200);
})
export {
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategories,
    getCategoryById
}