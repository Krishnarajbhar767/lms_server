import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { ValidationError, NotFoundError, AuthError } from "../utils/api_error.utils.";
import path from "path";
import fs from "fs";
import { logger } from "../config/logger.config";

// Get resource metadata (name, type, etc.)
export const getResourceMetadata = asyncHandler(async (req: Request<{ resourceId: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const resourceId = Number(req.params.resourceId);

    const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        include: {
            lesson: {
                include: {
                    section: {
                        select: {
                            courseId: true
                        }
                    }
                }
            }
        }
    });

    if (!resource) {
        throw new NotFoundError("Resource not found");
    }

    const courseId = resource.lesson.section.courseId;

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
        where: {
            userId: userId,
            courseId: courseId
        }
    });

    if (!enrollment) {
        throw new AuthError("You must be enrolled in this course to access this resource");
    }

    // Return metadata
    const fileName = path.basename(resource.url);
    const ext = path.extname(fileName).toLowerCase();
    
    let fileType = 'unknown';
    // PDF - can be previewed inline
    if (['.pdf'].includes(ext)) {
        fileType = 'pdf';
    }
    // Images - can be previewed inline 
    else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
        fileType = 'image';
    }
    // Documents - download to view
    else if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
        fileType = 'document';
    }
    // Videos
    else if (['.mp4', '.webm', '.ogg'].includes(ext)) {
        fileType = 'video';
    }

    return res.success("Resource metadata", {
        id: resource.id,
        name: resource.name,
        fileType,
        extension: ext
    }, 200);
});

// Get protected resource - only for enrolled users
export const getProtectedResource = asyncHandler(async (req: Request<{ resourceId: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const resourceId = Number(req.params.resourceId);

    // Get resource with lesson and course info
    const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        include: {
            lesson: {
                include: {
                    section: {
                        select: {
                            courseId: true
                        }
                    }
                }
            }
        }
    });

    if (!resource) {
        throw new NotFoundError("Resource not found");
    }

    const courseId = resource.lesson.section.courseId;

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
        where: {
            userId: userId,
            courseId: courseId
        }
    });

    if (!enrollment) {
        throw new AuthError("You must be enrolled in this course to access this resource");
    }

    // Serve the file
    logger.info('[ResourceController] Resource URL from DB:', resource.url);
    
    // Extract filename - handle both full URLs and plain filenames
    let fileName: string;
    try {
        // If it's a full URL (http://localhost:6572/resource/filename.pdf)
        if (resource.url.startsWith('http://') || resource.url.startsWith('https://')) {
            const url = new URL(resource.url);
            fileName = path.basename(url.pathname);
        } else {
            // If it's just a filename or relative path
            fileName = path.basename(resource.url);
        }
    } catch (err) {
        // Fallback to basename if URL parsing fails
        fileName = path.basename(resource.url);
    }
    
    logger.info('[ResourceController] Extracted filename:', fileName);
    const filePath = path.join(process.cwd(), "resource", fileName);
    logger.info('[ResourceController] Full file path:', filePath);
    logger.info('[ResourceController] File exists?', fs.existsSync(filePath));

   // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Log directory contents for debugging
        const resourceDir = path.join(process.cwd(), "resource");
        logger.info('[ResourceController] Resource directory:', resourceDir);
        if (fs.existsSync(resourceDir)) {
            const files = fs.readdirSync(resourceDir);
            logger.info('[ResourceController] Files in resource directory:', files);
        } else {
            logger.info('[ResourceController] Resource directory does not exist!');
        }
        throw new NotFoundError("Resource file not found");
    }

    // Send file with security headers
    res.setHeader('Content-Disposition', `inline; filename="${resource.name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.sendFile(filePath);
});
