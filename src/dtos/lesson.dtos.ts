import z from "zod";
import { createLessonSchema, updateLessonSchema } from "../validation/lesson.validation";

export type CreateLessonDto = z.infer<typeof createLessonSchema>
export type UpdateLessonDto = z.infer<typeof updateLessonSchema>