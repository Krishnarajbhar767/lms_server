import e from "express";
import { createSection, deleteSection, reorderSection, updateSection } from "../controller/section.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { createSectionSchema, updateSectionSchema } from "../validation/section.validation";

export const sectionRouter = e.Router()
sectionRouter.post("/create", isAuthenticated, isAdmin, validate(createSectionSchema), createSection)
sectionRouter.put("/update/:id", isAuthenticated, isAdmin, validate(updateSectionSchema), updateSection)
sectionRouter.put("/reorder/:courseId", isAuthenticated, isAdmin, reorderSection)
sectionRouter.delete("/delete/:id", isAuthenticated, isAdmin, deleteSection)
