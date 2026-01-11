import z from "zod";
import { createCategorySchema } from "../validation/category.validation";

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>
