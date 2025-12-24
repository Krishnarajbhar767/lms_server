import asyncHandler from "../utils/async_handler.utils";
import fs from "fs";
import path from "path";
import { CreateLessonDto } from "../dtos/lesson.dtos";
import { Request, Response } from "express";
import { ValidationError } from "../utils/api_error.utils.";
import { prisma } from "../prisma";
import { cache, clearCacheByPrefix, COURSE_ADMIN_CACHE_PREFIX, COURSE_CACHE_PREFIX } from "../utils/cache";

import { logger } from "../config/logger.config";
import { deleteBunnyVideo } from "../utils/delete-bunny-video";

export const createLesson = asyncHandler(async (req: Request<{}, {}, CreateLessonDto>, res: Response) => {
    const { title, bunnyVideoId, duration, sectionId, resource } = req.body;

    const normalizedTitle = title?.trim().toLowerCase();
    const sectionIdNum = Number(sectionId);

    if (!normalizedTitle) {
        throw new ValidationError("Title is required");
    }

    if (!sectionId || Number.isNaN(sectionIdNum)) {
        throw new ValidationError("Invalid section id");
    }

    const section = await prisma.section.findUnique({
        where: { id: sectionIdNum },
        select: { id: true, courseId: true },
    });

    if (!section) {
        throw new ValidationError("Section not found");
    }

    const lastLesson = await prisma.lesson.findFirst({
        where: { sectionId: sectionIdNum },
        orderBy: { order: "desc" },
        select: { order: true },
    });

    const nextOrder = (lastLesson?.order ?? 0) + 1;

    const lesson = await prisma.lesson.create({
        data: {
            title: normalizedTitle,
            bunnyVideoId,
            duration,
            sectionId: sectionIdNum,
            order: nextOrder,
        },
    });
    // create resource for this  lesson if resource exist
    if (resource) {
        await prisma.resource.create({
            data: {
                name: lesson.title,
                url: resource,
                lessonId: lesson.id,
            },
        });
    }
    // now send  latest Course Data
    const course = await prisma.course.findUnique({
        where: { id: section.courseId },
        include: {
            sections: {
                include: {
                    lessons: {
                        include: {
                            resource: true,
                        },
                    },
                },
            },
        },
    });
    // clear node cache for courses
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX);
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX);
    return res.success("Lesson created successfully", course, 201);
})

// /upload-resource
export const uploadResource = asyncHandler(async (req: any, res: Response) => {
    const resourceFile = req.files?.resource;
    if (!resourceFile) {
        throw new ValidationError("Resource file is required");
    }

    // Validate file type if needed (e.g. PDF, Doc)
    // const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    // if (!allowedTypes.includes(resourceFile.mimetype)) {
    //     throw new ValidationError("Invalid file type. Only PDF and Docs are allowed.");
    // }

    // make resource name unique so that when lesson delete its east to delete it
    const uploadDir = path.join(process.cwd(), "resource");
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = resourceFile.name.replace(/[^\w.-]/g, "_");
    const fileName = `resource-${uniqueSuffix}-${originalName}`;
    const filePath = path.join(uploadDir, fileName);

    try {
        await new Promise<void>((resolve, reject) => {
            resourceFile.mv(filePath, (err: any) => {
                if (err) return reject(err);
                resolve();
            });
        });
    } catch (error) {
        throw new ValidationError("Failed to upload resource");
    }

    const backendUrl = process.env.BACKEND_URL?.trim() || "http://localhost:6572";
    const resourceUrl = `${backendUrl}/resource/${fileName}`;
    res.success("Resource uploaded successfully", { resourceUrl }, 200);
});


export const deleteResource = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const resourceId = Number(id);

    const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        include: { lesson: { include: { section: true } } }
    });
    if (!resource) {
        throw new ValidationError("Resource not found");
    }

    const courseId = resource.lesson.section.courseId;

    // 1. Delete File from Storage
    const fileName = path.basename(resource.url);
    const filePath = path.join(process.cwd(), "resource", fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // 2. Delete Record
    await prisma.resource.delete({
        where: { id: resourceId },
    });

    // 3. Clear Cache
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX);
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX);

    // 4. Return Latest Course
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            sections: {
                include: {
                    lessons: {
                        include: {
                            resource: true,
                        },
                    },
                },
            },
        },
    });

    res.success("Resource deleted successfully", course, 200);
});
export const deleteResourceFile = asyncHandler(async (req: Request<{ resourceUrl: string }>, res: Response) => {
    // delete only given resource url delete only resource file not table  and if any resource.url is using same url then make them blank
    // Extract just the filename in case a full URL is stored
    const { resourceUrl } = req?.body;
    const fileName = path.basename(resourceUrl);
    const filePath = path.join(process.cwd(), "resource", fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    await prisma.resource.updateMany({
        where: { url: resourceUrl },
        data: { url: "" },
    });
    res.success("Resource deleted successfully", {}, 200);
})

// delete lesson with complete cleanup bunny video to resource
export const deleteLesson = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req?.params?.id;
    const lessonId = Number(id);

    if (Number.isNaN(lessonId)) {
        throw new ValidationError("Invalid lesson id");
    }

    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
            resource: true,
        },
    });

    if (!lesson) {
        throw new ValidationError("Lesson not found");
    }

    // 1. Delete Bunny Video from CDN
    if (lesson.bunnyVideoId) {
        logger.info(`Deleting bunny video with id: ${lesson.bunnyVideoId}`);
        await deleteBunnyVideo(lesson.bunnyVideoId);
    }

    // 2. Delete Resource Files from Local Storage
    if (lesson.resource && lesson.resource.length > 0) {
        for (const resource of lesson.resource) {
            // Extract filename from stored URL (handles both full URL and filename)
            const fileName = path.basename(resource.url);

            // Construct absolute path to the resource file in the 'resource' folder
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

    await prisma.lesson.delete({
        where: { id: lessonId },
    });

    // Clear caches to reflect changes immediately
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX);
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX);

    res.success("Lesson deleted successfully", {}, 200);
});
export const reorderLessons = asyncHandler(
    async (
        req: Request<
            { sectionId: string },
            {},
            {
                lessonOrder: {
                    id: string;
                    order: number;
                }[];
            }
        >,
        res: Response
    ) => {
        const sectionIdParam = req.params.sectionId;
        const sectionId = Number(sectionIdParam);
        const { lessonOrder } = req.body;

        if (Number.isNaN(sectionId)) {
            throw new ValidationError("Invalid sectionId");
        }

        if (!Array.isArray(lessonOrder) || lessonOrder.length === 0) {
            throw new ValidationError("lessonOrder must be a non-empty array");
        }

        // Basic payload validation
        for (const item of lessonOrder) {
            const idNum = Number(item.id);
            if (Number.isNaN(idNum)) {
                throw new ValidationError("All lesson ids must be valid numbers");
            }
            if (typeof item.order !== "number" || Number.isNaN(item.order)) {
                throw new ValidationError("All lesson orders must be valid numbers");
            }
        }

        // Check if section exists
        const section = await prisma.section.findUnique({
            where: { id: sectionId },
            select: { id: true, courseId: true },
        });

        if (!section) {
            throw new ValidationError("Section not found");
        }

        try {
            const updatedLessons = await prisma.$transaction(
                lessonOrder.map((lesson) =>
                    prisma.lesson.update({
                        where: { id: Number(lesson.id) },
                        data: { order: lesson.order },
                    })
                )
            );

            // clear cache
            clearCacheByPrefix(cache, COURSE_CACHE_PREFIX);
            clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX);

            return res.success("Lessons reordered successfully", updatedLessons, 200);
        } catch (error) {
            console.error("Reorder lessons error:", error);
            throw new ValidationError("Failed to reorder lessons");
        }
    }
);

export const updateLesson = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const { title, bunnyVideoId, duration, resource } = req.body;
    const lessonId = Number(id);

    if (Number.isNaN(lessonId)) {
        throw new ValidationError("Invalid lesson id");
    }

    const existingLesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { resource: true }
    });

    if (!existingLesson) {
        throw new ValidationError("Lesson not found");
    }

    const oldBunnyVideoId = existingLesson.bunnyVideoId;
    const oldResources = existingLesson.resource;

    // 1. Update Database
    const updatedLesson = await prisma.lesson.update({
        where: { id: lessonId },
        data: {
            title: title || existingLesson.title,
            bunnyVideoId: bunnyVideoId || existingLesson.bunnyVideoId,
            duration: duration !== undefined ? duration : existingLesson.duration,
        },
    });

    // 2. Handle Resource Update
    const currentResourceUrl = (existingLesson.resource && existingLesson.resource.length > 0) ? existingLesson?.resource?.[0]?.url : "";
    if (resource && resource !== currentResourceUrl) {
        // Delete old resource entries if any
        if (oldResources.length > 0) {
            for (const oldRes of oldResources) {
                const fileName = path.basename(oldRes.url);
                const filePath = path.join(process.cwd(), "resource", fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            await prisma.resource.deleteMany({
                where: { lessonId: lessonId }
            });
        }

        // Create new resource entry
        await prisma.resource.create({
            data: {
                name: updatedLesson.title,
                url: resource,
                lessonId: lessonId,
            },
        });
    }

    // 3. Cleanup Old Video from Bunny if it has changed
    if (bunnyVideoId && oldBunnyVideoId && bunnyVideoId !== oldBunnyVideoId) {
        try {
            await deleteBunnyVideo(oldBunnyVideoId);
            logger.info(`Deleted old bunny video: ${oldBunnyVideoId}`);
        } catch (error) {
            logger.error(`Failed to delete old bunny video: ${oldBunnyVideoId}`, error);
        }
    }

    // 4. Return Latest Course Data
    const section = await prisma.section.findUnique({
        where: { id: existingLesson.sectionId },
        select: { courseId: true }
    });

    if (!section || !section.courseId) {
        throw new ValidationError("Course not found for this lesson");
    }

    const course = await prisma.course.findUnique({
        where: { id: section.courseId },
        include: {
            sections: {
                include: {
                    lessons: {
                        include: {
                            resource: true,
                        },
                    },
                },
            },
        },
    });

    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX);
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX);

    return res.success("Lesson updated successfully", course, 200);
});
