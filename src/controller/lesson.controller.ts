import asyncHandler from "../utils/async_handler.utils";
import fs from "fs";
import path from "path";
import { CreateLessonDto } from "../dtos/lesson.dtos";
import { Request, Response } from "express";
import { ValidationError } from "../utils/api_error.utils";
import { prisma } from "../prisma";
import { clearCacheByPrefix, COURSE_ADMIN_CACHE_PREFIX, COURSE_CACHE_PREFIX } from "../utils/cache";

import { logger } from "../config/logger.config";
import { deleteBunnyVideo } from "../utils/delete-bunny-video";

export const createLesson = asyncHandler(async (req: Request<{}, {}, CreateLessonDto & { resources?: { name: string, url: string }[] }>, res: Response) => {
    const { title, bunnyVideoId, duration, sectionId, resources } = req.body;

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
    // create resource for this  lesson if resources exist
    if (resources && resources.length > 0) {
        await prisma.resource.createMany({
            data: resources.map(res => ({
                name: res.name,
                url: res.url,
                lessonId: lesson.id,
            }))
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
    // clear cache
    await clearCacheByPrefix(COURSE_CACHE_PREFIX);
    await clearCacheByPrefix(COURSE_ADMIN_CACHE_PREFIX);
    return res.success("Lesson created successfully", course, 201);
})

// /upload-resource
export const uploadResource = asyncHandler(async (req: any, res: Response) => {
    const resourceFile = req.files?.resource;
    if (!resourceFile) {
        throw new ValidationError("Resource file is required");
    }

    // Validate file type - Allow PDF, Word, Excel, PowerPoint, Images
    const allowedTypes = [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx  
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ];
    
    if (!allowedTypes.includes(resourceFile.mimetype)) {
        throw new ValidationError("Invalid file type. Only PDF, Word, Excel, PowerPoint, and Images are allowed.");
    }

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

    // clear cache
    await clearCacheByPrefix(COURSE_CACHE_PREFIX);
    await clearCacheByPrefix(COURSE_ADMIN_CACHE_PREFIX);

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

    // clear cache
    await clearCacheByPrefix(COURSE_CACHE_PREFIX);
    await clearCacheByPrefix(COURSE_ADMIN_CACHE_PREFIX);

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
            await clearCacheByPrefix(COURSE_CACHE_PREFIX);
            await clearCacheByPrefix(COURSE_ADMIN_CACHE_PREFIX);

            return res.success("Lessons reordered successfully", updatedLessons, 200);
        } catch (error) {
            console.error("Reorder lessons error:", error);
            throw new ValidationError("Failed to reorder lessons");
        }
    }
);

export const updateLesson = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const { title, bunnyVideoId, duration, newResources } = req.body;
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

    // 1. Update Lesson Details
    const updatedLesson = await prisma.lesson.update({
        where: { id: lessonId },
        data: {
            title: title || existingLesson.title,
            bunnyVideoId: bunnyVideoId || existingLesson.bunnyVideoId,
            duration: duration !== undefined ? duration : existingLesson.duration,
        },
    });

    // 2. Add New Resources if provided
    if (newResources && newResources.length > 0) {
        await prisma.resource.createMany({
            data: newResources.map((res: any) => ({
                name: res.name,
                url: res.url,
                lessonId: lessonId,
            }))
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

    await clearCacheByPrefix(COURSE_CACHE_PREFIX);
    await clearCacheByPrefix(COURSE_ADMIN_CACHE_PREFIX);

    return res.success("Lesson updated successfully", course, 200);
});

// Mark lesson as complete
export const markLessonComplete = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const lessonId = Number(req.params.id);
    const { watchedPercentage } = req.body;

    if (Number.isNaN(lessonId)) {
        throw new ValidationError("Invalid lesson id");
    }

    // Must watch at least 50%
    if (!watchedPercentage || watchedPercentage < 50) {
        throw new ValidationError("Please watch at least 50% of the video");
    }

    // Get lesson and verify enrollment
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { section: true }
    });
    if (!lesson) throw new ValidationError("Lesson not found");

    const courseId = lesson.section.courseId;
    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } }
    });
    if (!enrollment) throw new ValidationError("Not enrolled in this course");

    // Mark lesson as complete
    await prisma.lessonProgress.upsert({
        where: { lessonId_userId: { lessonId, userId } },
        create: { lessonId, userId, isComplete: true, completedAt: new Date() },
        update: { isComplete: true, completedAt: new Date() }
    });

    // Update course progress percentage
    const totalLessons = await prisma.lesson.count({ where: { section: { courseId } } });
    const completedLessons = await prisma.lessonProgress.count({
        where: { userId, isComplete: true, lesson: { section: { courseId } } }
    });
    const percentage = Math.round((completedLessons / totalLessons) * 100);

    await prisma.courseProgress.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, percentage },
        update: { percentage }
    });

    res.success("Lesson completed", { percentage, lessonId });
});

// Save watch progress
export const saveWatchProgress = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const lessonId = Number(req.params.id);
    const { watchedSeconds } = req.body;

    if (Number.isNaN(lessonId)) {
        throw new ValidationError("Invalid lesson id");
    }

    if (typeof watchedSeconds !== 'number' || watchedSeconds < 0) {
        throw new ValidationError("Invalid watchedSeconds");
    }

    // Upsert the progress - only save if new value is greater
    await prisma.lessonProgress.upsert({
        where: { lessonId_userId: { lessonId, userId } },
        create: { lessonId, userId, watchedSeconds, isComplete: false },
        update: {
            watchedSeconds: {
                // Only update if new value is greater (prevents going backwards)
                set: watchedSeconds
            }
        }
    });

    res.success("Progress saved", { watchedSeconds });
});

// Get lesson progress for user 
export const getLessonProgressForCourse = asyncHandler(async (req: Request<{ courseId: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const courseId = Number(req.params.courseId);

    if (Number.isNaN(courseId)) {
        throw new ValidationError("Invalid course id");
    }

    // Get all lesson progress for this user in this course
    const progress = await prisma.lessonProgress.findMany({
        where: {
            userId,
            lesson: {
                section: { courseId }
            }
        },
        select: {
            lessonId: true,
            watchedSeconds: true,
            isComplete: true
        }
    });

    // Get all quiz attempts for this user in this course
    const quizAttempts = await prisma.quizAttempt.findMany({
        where: {
            userId,
            quiz: {
                section: { courseId }
            }
        },
        select: {
            quizId: true,
            score: true,
            passed: true
        }
    });

    // Convert lesson progress to map
    const lessonProgressMap = progress.reduce((acc, p) => {
        acc[p.lessonId] = { watchedSeconds: p.watchedSeconds, isComplete: p.isComplete };
        return acc;
    }, {} as Record<number, { watchedSeconds: number, isComplete: boolean }>);

    // Convert quiz attempts to map
    const quizAttemptsMap = quizAttempts.reduce((acc, a) => {
        acc[a.quizId] = { score: a.score, passed: a.passed };
        return acc;
    }, {} as Record<number, { score: number, passed: boolean }>);

    res.success("Progress fetched", {
        lessons: lessonProgressMap,
        quizzes: quizAttemptsMap
    });
});
