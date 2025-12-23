import z from "zod";

export const createLessonSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long").max(100, "Title must be at most 100 characters long"),
    bunnyVideoId: z.string(),

    duration: z.number(),
    sectionId: z.number(),
    resource: z.string().optional(),
})

export const updateLessonSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long").max(100, "Title must be at most 100 characters long"),
    bunnyVideoId: z.string(),

    duration: z.number(),
    sectionId: z.number(),
    resource: z.string().optional(),
})

