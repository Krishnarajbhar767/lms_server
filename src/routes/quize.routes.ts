import { Router } from "express";
import { upsertQuize, getQuizeBySection, deleteQuize } from "../controller/quize.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { upsertQuizeSchema } from "../validation/quize.validation";

export const quizeRouter = Router();

quizeRouter.post("/upsert", isAuthenticated, isAdmin, validate(upsertQuizeSchema), upsertQuize);
quizeRouter.get("/section/:sectionId", isAuthenticated, getQuizeBySection);
quizeRouter.delete("/:id", isAuthenticated, isAdmin, deleteQuize);
