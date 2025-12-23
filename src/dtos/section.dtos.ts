import z from "zod";
import { createSectionSchema } from "../validation/section.validation";

export type CreateSectionDto = z.infer<typeof createSectionSchema>