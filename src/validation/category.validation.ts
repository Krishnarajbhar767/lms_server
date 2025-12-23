import z from "zod";

const createCategorySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters long").max(100, "Name must be at most 100 characters long"),
    description: z.string().min(3, "Description must be at least 3 characters long").max(100, "Description must be at most 100 characters long"),
})

export {
    createCategorySchema
}