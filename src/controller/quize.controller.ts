import { prisma } from "../prisma";
import asyncHandler from "../utils/async_handler.utils";
import { Request, Response } from "express";
import { ValidationError } from "../utils/api_error.utils.";
import { upsertQuizeSchema } from "../validation/quize.validation";
import { logger } from "../config/logger.config";

export const upsertQuize = asyncHandler(
    async (req: Request, res: Response) => {
        const validatedData = upsertQuizeSchema.parse(req.body);
        const { sectionId, title, questions } = validatedData;

        logger.info(`Starting quiz upsert for section ${sectionId}`, { title, questionCount: questions.length });

        // Check if section exists
        const section = await prisma.section.findUnique({
            where: { id: sectionId }
        });

        if (!section) {
            throw new ValidationError("Section not found");
        }

        // Use transaction to ensure atomicity
        const quize = await prisma.$transaction(async (tx) => {
            // Check if quiz already exists for this section
            const existingQuize = await tx.quize.findUnique({
                where: { sectionId }
            });

            // If questions are empty, we should delete the quiz if it exists
            if (questions.length === 0) {
                if (existingQuize) {
                    await tx.quize.delete({
                        where: { id: existingQuize.id }
                    });
                }
                return null;
            }

            let currentQuize;
            if (existingQuize) {
                logger.info(`Updating existing quiz ${existingQuize.id} for section ${sectionId}`);
                // Update the existing Quize
                currentQuize = await tx.quize.update({
                    where: { id: existingQuize.id },
                    data: { title }
                });
            } else {
                logger.info(`Creating new quiz for section ${sectionId}`);
                // Create a new Quize
                currentQuize = await tx.quize.create({
                    data: { title, sectionId }
                });
            }

            // Delete existing questions (options will be deleted via cascade)
            await tx.question.deleteMany({
                where: { quizeId: currentQuize.id }
            });

            // Create new questions and options
            for (const q of questions) {
                await tx.question.create({
                    data: {
                        title: q.title,
                        quizeId: currentQuize.id,
                        options: {
                            create: q.options.map((o: any) => ({
                                title: o.title,
                                isCorrect: o.isCorrect
                            }))
                        }
                    }
                });
            }

            return tx.quize.findUnique({
                where: { id: currentQuize.id },
                include: {
                    questions: {
                        include: {
                            options: true
                        }
                    }
                }
            });
        });

        const message = questions.length === 0 ? "Quiz removed successfully" : "Quiz saved successfully";
        logger.info(`Quiz upsert completed for section ${sectionId}`, { message });
        return res.success(message, quize, 201);
    }
);

export const getQuizeBySection = asyncHandler(
    async (req: Request<{ sectionId: string }>, res: Response) => {
        const sectionId = Number(req.params.sectionId);

        if (isNaN(sectionId)) {
            throw new ValidationError("Invalid section ID");
        }

        const quize = await prisma.quize.findUnique({
            where: { sectionId },
            include: {
                questions: {
                    include: {
                        options: true
                    }
                }
            }
        });

        if (!quize) {
            return res.success("No quiz found for this section", null, 200);
        }

        return res.success("Quiz fetched successfully", quize, 200);
    }
);

export const deleteQuize = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const quizeId = Number(req.params.id);

        if (isNaN(quizeId)) {
            throw new ValidationError("Invalid quiz ID");
        }

        const quize = await prisma.quize.findUnique({
            where: { id: quizeId }
        });

        if (!quize) {
            throw new ValidationError("Quiz not found");
        }

        await prisma.quize.delete({
            where: { id: quizeId }
        });

        return res.success("Quiz deleted successfully", null, 200);
    }
);

// Submit quiz answers
export const submitQuiz = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const userId = Number(req.user.id);
        const quizId = Number(req.params.id);
        const { answers } = req.body; // answers: { questionId: optionId }

        if (isNaN(quizId)) {
            throw new ValidationError("Invalid quiz ID");
        }

        // Get quiz with questions and options
        const quiz = await prisma.quize.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    include: { options: true }
                }
            }
        });

        if (!quiz) {
            throw new ValidationError("Quiz not found");
        }

        // Calculate score
        let correct = 0;
        const total = quiz.questions.length;

        for (const question of quiz.questions) {
            const selectedOptionId = answers[question.id];
            const correctOption = question.options.find(o => o.isCorrect);
            if (correctOption && correctOption.id === selectedOptionId) {
                correct++;
            }
        }

        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        const passed = score >= 70; // 70% to pass

        // Upsert attempt (user can retry)
        const attempt = await prisma.quizAttempt.upsert({
            where: { userId_quizId: { userId, quizId } },
            create: { userId, quizId, score, passed },
            update: { score, passed }
        });

        return res.success(
            passed ? "Quiz passed!" : "Quiz not passed. Try again!",
            { score, passed, correct, total, attemptId: attempt.id },
            200
        );
    }
);

// Get quiz attempt
export const getQuizAttempt = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const userId = Number(req.user.id);
        const quizId = Number(req.params.id);

        if (isNaN(quizId)) {
            throw new ValidationError("Invalid quiz ID");
        }

        const attempt = await prisma.quizAttempt.findUnique({
            where: { userId_quizId: { userId, quizId } }
        });

        return res.success("Attempt fetched", attempt, 200);
    }
);
