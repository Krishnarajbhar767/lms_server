import z from "zod";

export const optionSchema = z.object({
    id: z.number().int().optional(),
    title: z.string().min(1, "Option title is required"),
    isCorrect: z.boolean().default(false),
});

export const questionSchema = z.object({
    id: z.number().int().optional(),
    title: z.string().min(1, "Question title is required"),
    options: z.array(optionSchema).min(1, "At least one option is required"),
});

export const upsertQuizeSchema = z.object({
    sectionId: z.number().int().positive(),
    title: z.string().min(3, "Quiz title must be at least 3 characters long"),
    questions: z.array(questionSchema).min(0),
});
