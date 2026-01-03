import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { CreateCourseDto } from "../dtos/course.dtos";
import { prisma } from "../prisma";
import { ValidationError } from "../utils/api_error.utils.";
import fs from "fs";
import path from "path";
import { UploadedFile } from "express-fileupload";
import { slugify } from "../utils/slugify.utils";

import { cache, clearCacheByPrefix, COURSE_ADMIN_CACHE_PREFIX, COURSE_CACHE_PREFIX } from "../utils/cache";


// Extend Request type locally for this file
interface FileUploadRequest extends Request {
    files?: {
        thumbnail: UploadedFile;
    }
    body: {
        courseName: string;
        isEditing: boolean
    }
}
export const uploadThumbnailController = asyncHandler(async (req: FileUploadRequest, res: Response) => {
    const courseName = req.body?.courseName;
    const thumbnail = req.files?.thumbnail;
    const isEditing = req.files?.thumbnail
    if (!thumbnail) {
        throw new ValidationError('Thumbnail is required')
    }
    if (!courseName) {
        throw new ValidationError('Course name is required')
    }
    const slugifiedCourseName = slugify(courseName);
    const uploadDir = path.join(__dirname, "../../uploads", slugifiedCourseName);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(thumbnail.name); // .jpg / .png / .webp
    const fileName = `${slugifiedCourseName}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    // check if file already exists
    if (fs.existsSync(filePath) && !isEditing) {
        throw new ValidationError('Course with this name already exists')
    }
    try {
        await new Promise<void>((resolve, reject) => {
            thumbnail.mv(filePath, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

    } catch (error) {
        // if something wrong heppends delete the file
        fs.unlinkSync(filePath);
        throw new ValidationError('Failed to upload thumbnail')
    }
    const thumbnailUrl = `${process.env.BACKEND_URL}/uploads/${slugifiedCourseName}/${fileName}`;

    res.success('Thumbnail uploaded successfully.', thumbnailUrl, 201)
})

export const createCourse = asyncHandler(async (req: Request<{}, {}, CreateCourseDto>, res: Response) => {
    const { title, description, price, originalPrice, categoryId, thumbnail, language, whatYouWillLearn } = req.body;
    const isExistingCourse = await prisma.course.findUnique({ where: { title: title.toLowerCase().trim() } })
    if (isExistingCourse) {
        throw new ValidationError('Course already exists with this exact title')
    }
    const course = await prisma.course.create({
        data: {
            title: title.toLowerCase().trim(),
            description: description.toLowerCase().trim(),
            price,
            originalPrice: originalPrice || null,
            categoryId,
            thumbnail,
            language: language.map((l: string) => l.toLowerCase()),
            whatYouWillLearn: whatYouWillLearn || []
        }
    })

    // clear all cache related to courses when new course is created
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)

    res.success("Course created successfully", course, 201)
})

export const updateCourse = asyncHandler(async (req: Request<{ id: string }, {}, CreateCourseDto>, res: Response) => {
    const { id } = req.params;
    const { title, description, price, originalPrice, categoryId, thumbnail, language, whatYouWillLearn } = req.body;
    // check with this title course is already exists.
    const isExistingCourse = await prisma.course.findUnique({ where: { title: title.toLowerCase().trim() } })
    if (isExistingCourse && isExistingCourse.id !== Number(id)) {
        throw new ValidationError('Another course already exists with this exact title')
    }
    const course = await prisma.course.update({
        where: { id: Number(id) },
        data: {
            title: title.toLowerCase().trim(),
            description: description.toLowerCase().trim(),
            price,
            originalPrice: originalPrice || null,
            categoryId,
            thumbnail,
            language: language.map((l: string) => l.toLowerCase()),
            whatYouWillLearn: whatYouWillLearn || []
        }
    })

    // clear all cache related to courses when course is updated
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)

    res.success("Course updated successfully", course, 200)
})

export const archiveCourse = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params?.id;
    if (!id) {
        throw new ValidationError('Course id is required')
    }
    // check course exit or not 
    const isExistingCourse = await prisma.course.findUnique({ where: { id: Number(id) } })
    if (!isExistingCourse) {
        throw new ValidationError('Course not found')
    }
    const course = await prisma.course.update({ where: { id: Number(id) }, data: { status: "ARCHIVED" } })

    // clear all cache related to courses when course is archived
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)

    res.success("Course archived successfully", course)
})


export const getAllCoursesForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit

    const cacheKey = `${COURSE_ADMIN_CACHE_PREFIX}p${page}_l${limit}`
    const cache_data = await cache.get(cacheKey)
    if (cache_data) {
        return res.success("Courses fetched successfully", cache_data)
    }
    // get all courses  based based on lates courses based on updated at and created at
    const [courses, totalCourses] = await Promise.all([
        prisma.course.findMany({
            include: { category: true, sections: { include: { lessons: { include: { resource: true } } } } },
            skip,
            take: limit,
            orderBy: [
                { createdAt: "desc" },
                { updatedAt: "desc" },
                { title: "asc" }
            ]
        }),
        prisma.course.count()
    ])

    const totalPages = Math.ceil(totalCourses / limit)
    const responseData = {
        courses,
        pagination: {
            totalCourses,
            totalPages,
            currentPage: page,
            limit
        }
    }

    cache.set(cacheKey, responseData)
    res.success("Courses fetched successfully", responseData)
})

export const getAllCoursesForStudent = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const search = req.query.search as string | undefined
    const categoryId = req.query.categoryId as string | undefined
    const sortBy = (req.query.sortBy as string) || "new"

    const skip = (page - 1) * limit

    // Build cache key with all params
    const cacheKey = `${COURSE_CACHE_PREFIX}p${page}_l${limit}_s${search || ""}_c${categoryId || ""}_sb${sortBy}`
    const cache_data = await cache.get(cacheKey)
    if (cache_data) {
        return res.success("Courses fetched successfully cache", cache_data)
    }

    // Build where clause
    const where: {
        status: "PUBLISHED";
        categoryId?: number;
        OR?: { title?: { contains: string; mode: "insensitive" }; description?: { contains: string; mode: "insensitive" } }[];
    } = { status: "PUBLISHED" }

    if (categoryId) {
        where.categoryId = Number(categoryId)
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
        ]
    }

    // Build orderBy clause
    let orderBy: object[] = [{ createdAt: "desc" }]
    if (sortBy === "popular" || sortBy === "trending") {
        orderBy = [{ enrollments: { _count: "desc" } }, { createdAt: "desc" }]
    }

    const [courses, totalCourses] = await Promise.all([
        prisma.course.findMany({
            where,
            include: {
                category: true,
                sections: {
                    orderBy: { order: "asc" },
                    include: {
                        lessons: {
                            orderBy: { order: "asc" },
                            include: { resource: true }
                        },
                    },
                },
                _count: { select: { enrollments: true } }
            },
            skip,
            take: limit,
            orderBy
        }),
        prisma.course.count({ where })
    ])

    const totalPages = Math.ceil(totalCourses / limit)
    const responseData = {
        courses,
        pagination: {
            totalCourses,
            totalPages,
            currentPage: page,
            limit
        }
    }

    cache.set(cacheKey, responseData)
    res.success("Courses fetched successfully", responseData)
})

// Clear all cache - Admin only
export const clearAllCache = asyncHandler(async (_req: Request, res: Response) => {
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)
    res.success("All cache cleared successfully", null)
})

export const getCourseById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params?.id;
    if (!id) {
        throw new ValidationError('Course id is required')
    }
    // include category  ,lesson,section all detals of course means  excute all related tables course => sections => lessons // order lesson and section in "ascending order"
    const course = await prisma.course.findUnique({ where: { id: Number(id) }, include: { category: true, sections: { include: { lessons: { include: { resource: true }, orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } } })
    if (!course) {
        throw new ValidationError('Course not found')
    }
    res.success("Course fetched successfully", course)
})
// make course public or draft
export const updateCourseStatus = asyncHandler(async (req: Request<{ id: string }, {}, {
    status: "PUBLISHED" | "DRAFT"
}>, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) {
        throw new ValidationError('Course id is required')
    }
    // check course exit or not 
    const isExistingCourse = await prisma.course.findUnique({ where: { id: Number(id) } })
    if (!isExistingCourse) {
        throw new ValidationError('Course not found')
    }
    const course = await prisma.course.update({ where: { id: Number(id) }, data: { status: status } })
    // clear all cache related to courses when course is published
    clearCacheByPrefix(cache, COURSE_CACHE_PREFIX)
    clearCacheByPrefix(cache, COURSE_ADMIN_CACHE_PREFIX)
    res.success("Course published successfully", course)
})