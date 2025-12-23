import z from "zod";

export const createCourseSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long"),
    description: z.string().min(3, "Description must be at least 3 characters long").max(1000, "Description must be at most 1000 characters long"),
    price: z.number().min(0, "Price must be at least 0"),
    categoryId: z.number().int().min(0, "Category ID must be a positive integer"),
    thumbnail: z.url("Thumbnail must be a valid URL"),
    language: z.string()
})



