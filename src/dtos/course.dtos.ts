import { createCourseSchema } from "../validation/course.validation";
import z from "zod";

export type CreateCourseDto = z.infer<typeof createCourseSchema>


