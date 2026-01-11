import { deleteBunnyVideo } from "../utils/delete-bunny-video";
import path from "path";
import fs from "fs";

import asyncHandler from "../utils/async_handler.utils";
import { CreateSectionDto } from "../dtos/section.dtos";
import { prisma } from "../prisma";
import { ValidationError } from "../utils/api_error.utils";
import { cache, clearCacheByPrefix, COURSE_ADMIN_CACHE_PREFIX, COURSE_CACHE_PREFIX } from "../utils/cache";
import { Request, Response } from "express";
import { logger } from "../config/logger.config";
export const createSection = asyncHandler(
    async (req: Request<{}, {}, CreateSectionDto>, res: Response) => {
        const { title, courseId } = req.body;

        const normalizedTitle = title?.trim().toLowerCase();
        const courseIdNum = Number(courseId);

        if (!normalizedTitle) {
            throw new ValidationError("Title is required");
        }

        if (!courseId || Number.isNaN(courseIdNum)) {
            throw new ValidationError("Invalid courseId");
        }

        // Run independent queries in parallel
        const [course, existingSection, lastSection] = await Promise.all([
            prisma.course.findUnique({ where: { id: courseIdNum } }),
            prisma.section.findFirst({
                where: { courseId: courseIdNum, title: normalizedTitle },
            }),
            prisma.section.findFirst({
                where: { courseId: courseIdNum },
                orderBy: { order: "desc" },
                select: { order: true },
            }),
        ]);

        if (!course) {
            throw new ValidationError("Course not found");
        }

        if (existingSection) {
            throw new ValidationError("Section already exists with this title");
        }

        const nextOrder = (lastSection?.order ?? 0) + 1;

        const section = await prisma.section.create({
            data: {
                title: normalizedTitle,
                courseId: courseIdNum,
                order: nextOrder,
            },
        });
        // clear all cache related to courses when new course is created
        clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
        clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)
        return res.success("Section created successfully", section, 201);
    }
);

export const updateSection = asyncHandler(
    async (req: Request<{ id: string }, {}, CreateSectionDto>, res: Response) => {
        const { id } = req.params;
        const { title } = req.body;

        const normalizedTitle = title?.trim().toLowerCase();
        const sectionId = Number(id);

        if (!normalizedTitle) {
            throw new ValidationError("Title is required");
        }

        if (Number.isNaN(sectionId)) {
            throw new ValidationError("Invalid section id");
        }

        // Fetch section & check duplicates concurrently
        const existingSection = await prisma.section.findUnique({
            where: { id: sectionId },
            select: { id: true, courseId: true },
        });

        if (!existingSection) {
            throw new ValidationError("Section not found");
        }

        const duplicate = await prisma.section.findFirst({
            where: {
                courseId: existingSection.courseId,
                title: normalizedTitle,
                NOT: { id: sectionId }, // ignore itself
            },
            select: { id: true },
        });

        if (duplicate) {
            throw new ValidationError("Another section with this title already exists");
        }

        const updated = await prisma.section.update({
            where: { id: sectionId },
            data: { title: normalizedTitle },
        });
        // clear all cache related to courses when new course is created
        clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
        clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)
        return res.success("Section updated successfully", updated, 200);
    }
);

export const reorderSection = asyncHandler(
    async (
        req: Request<
            { courseId: string },
            {},
            {
                sectionOrder: {
                    id: string;
                    order: number;
                }[];
            }
        >,
        res: Response
    ) => {
        const courseIdParam = req.params.courseId;
        logger.info('courseIdParam', courseIdParam);
        const courseId = Number(courseIdParam);
        const { sectionOrder } = req.body;
        logger.info("REORDER REQUEST:", { courseId, sectionOrderLength: sectionOrder?.length, sectionOrder });

        if (Number.isNaN(courseId)) {
            throw new ValidationError("Invalid courseId");
        }

        if (!Array.isArray(sectionOrder) || sectionOrder.length === 0) {
            throw new ValidationError("sectionOrder must be a non-empty array");
        }

        // Basic payload validation
        for (const item of sectionOrder) {
            const idNum = Number(item.id);
            if (Number.isNaN(idNum)) {
                throw new ValidationError("All section ids must be valid numbers");
            }
            if (typeof item.order !== "number" || Number.isNaN(item.order)) {
                throw new ValidationError("All section orders must be valid numbers");
            }
        }

        // Optional: prevent duplicate ids / orders in payload
        const idsSet = new Set(sectionOrder.map((s) => s.id));
        if (idsSet.size !== sectionOrder.length) {
            throw new ValidationError("Duplicate section ids in sectionOrder");
        }

        // Check if course exists
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true },
        });

        if (!course) {
            throw new ValidationError("Course not found");
        }

        // Verify all sections belong to this course
        const sectionIds = sectionOrder.map((s) => Number(s.id));
        const existingSections = await prisma.section.findMany({
            where: {
                courseId,
                id: { in: sectionIds },
            },
            select: { id: true },
        });

        if (existingSections.length !== sectionOrder.length) {
            throw new ValidationError(
                "Some sections do not belong to this course or do not exist"
            );
        }

        try {
            const updatedSections = await prisma.$transaction(
                sectionOrder.map((section) =>
                    prisma.section.update({
                        where: { id: Number(section.id) },
                        data: { order: section.order },
                    })
                )
            );
            // clear all cache related to courses when new course is created
            clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
            logger.info("Sections reordered successfully");
            clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)

            return res.success("Sections reordered successfully", updatedSections, 200);
        } catch (error) {
            logger.error("Reorder sections error:", error);
            throw new ValidationError("Failed to reorder sections");
        }
    }

);

export const deleteSection = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const id = req.params?.id;
        logger.info("Deleting section with id: ", id);
        const sectionId = Number(id);

        if (Number.isNaN(sectionId)) {
            throw new ValidationError("Invalid section id");
        }

        const section = await prisma.section.findUnique({
            where: { id: sectionId },
            include: {
                lessons: {
                    include: {
                        resource: true,
                    },
                },
            },
        });

        if (!section) {
            throw new ValidationError("Section not found");
        }

        // 1. Delete Bunny Videos
        // 2. Delete Resource Files
        for (const lesson of section.lessons) {
            logger.info("Deleting lesson with id: ", lesson.id);
            if (lesson.bunnyVideoId) {
                logger.info("Deleting bunny video with id: ", lesson.bunnyVideoId);
                await deleteBunnyVideo(lesson.bunnyVideoId);
            }
            if (lesson.resource && lesson.resource.length > 0) {
                logger.info("Deleting resource with id: ", lesson.resource);
                for (const resource of lesson.resource) {
                    // Extract just the filename in case a full URL is stored
                    // e.g., "http://localhost:5000/uploads/resources/file.pdf" -> "file.pdf"
                    const fileName = path.basename(resource.url);

                    // Construct the absolute path to the resource file
                    const filePath = path.join(process.cwd(), "resource", fileName);

                    logger.info(`Attempting to delete resource file: ${filePath}`);

                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        logger.info(`Successfully deleted resource file: ${fileName}`);
                    } else {
                        logger.warn(`Resource file not found on disk: ${filePath}`);
                    }
                }
            }
        }

        await prisma.section.delete({
            where: { id: sectionId },
        });
        // clear all cache related to courses when new course is created
        clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
        clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)
        return res.success("Section deleted successfully", null, 200);
    }
)


