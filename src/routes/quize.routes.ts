import { Router } from "express";
import { upsertQuize, getQuizeBySection, deleteQuize, submitQuiz, getQuizAttempt } from "../controller/quize.controller";
import { isAuthenticated, isAdmin, isStudent } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { upsertQuizeSchema } from "../validation/quize.validation";

export const quizeRouter = Router();

// Admin routes
quizeRouter.post("/upsert", isAuthenticated, isAdmin, validate(upsertQuizeSchema), upsertQuize);
quizeRouter.get("/section/:sectionId", isAuthenticated, getQuizeBySection);
quizeRouter.delete("/:id", isAuthenticated, isAdmin, deleteQuize);

// Student routes
quizeRouter.post("/:id/submit", isAuthenticated, isStudent, submitQuiz);
quizeRouter.get("/:id/attempt", isAuthenticated, isStudent, getQuizAttempt);
