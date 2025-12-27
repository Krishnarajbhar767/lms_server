
import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth.middleware";
import { createCategorySchema } from "../validation/category.validation";
import { validate } from "../middleware/zod_validate.middleware";
import { createCategory, deleteCategory, getAllCategories, getCategoryById, updateCategory, getAdminCategories } from "../controller/category.controller";
const categoryRouter = express.Router();

categoryRouter.post('/', isAuthenticated, isAdmin, validate(createCategorySchema), createCategory)
categoryRouter.put('/:id', isAuthenticated, isAdmin, validate(createCategorySchema), updateCategory)
categoryRouter.delete('/:id', isAuthenticated, isAdmin, deleteCategory)
categoryRouter.get('/all', getAllCategories) // Public: Filtered
categoryRouter.get('/admin-all', isAuthenticated, isAdmin, getAdminCategories) // Admin: All
categoryRouter.get('/:id', getCategoryById)
export {
    categoryRouter
}