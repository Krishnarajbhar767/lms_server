import { Request, Response } from "express"
import asyncHandler from "../utils/async_handler.utils"
import { prisma } from "../prisma"
import { ApiError } from "../utils/api_error.utils"
import sanitizeHtml from "sanitize-html"

/**
 * Sanitize user input to prevent XSS attacks
 * Strips ALL HTML tags and allows only plain text
 */
function sanitizeComment(input: string | undefined | null): string | null {
    if (!input || typeof input !== "string") return null
    
    // Strip all HTML tags completely - no tags allowed
    const sanitized = sanitizeHtml(input, {
        allowedTags: [], // No HTML tags allowed
        allowedAttributes: {}, // No attributes allowed
        disallowedTagsMode: "recursiveEscape", // Escape any remaining tags
    })
    
    // Additional cleanup: trim and limit length
    const cleaned = sanitized
        .trim()
        .replace(/\s+/g, " ") // Normalize whitespace
        .slice(0, 500) // Max 500 characters
    
    return cleaned || null
}

/**
 * Recalculate and update course average rating
 */
async function recalculateCourseRating(courseId: number): Promise<void> {
    const result = await prisma.review.aggregate({
        where: { courseId },
        _avg: { rating: true },
        _count: { rating: true },
    })

    await prisma.course.update({
        where: { id: courseId },
        data: {
            averageRating: result._avg.rating || 0,
            reviewCount: result._count.rating || 0,
        },
    })
}

/**
 * Submit or update a review (upsert)
 * POST /api/reviews/:courseId
 */
export const submitReview = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id)
    const courseId = Number(req.params.courseId)
    const { rating, comment } = req.body

    // Validate courseId
    if (!courseId || isNaN(courseId)) {
        throw new ApiError(400, "Invalid course ID")
    }

    // Validate rating (must be integer 1-5)
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be an integer between 1 and 5")
    }

    // Sanitize comment - production-level XSS protection
    const sanitizedComment = sanitizeComment(comment)

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findUnique({
        where: {
            userId_courseId: { userId, courseId }
        }
    })

    if (!enrollment) {
        throw new ApiError(403, "You must be enrolled in this course to leave a review")
    }

    // Upsert review (create or update)
    const review = await prisma.review.upsert({
        where: {
            userId_courseId: { userId, courseId }
        },
        create: {
            userId,
            courseId,
            rating,
            comment: sanitizedComment,
        },
        update: {
            rating,
            comment: sanitizedComment,
        },
        include: {
            user: {
                select: { firstName: true, lastName: true }
            }
        }
    })

    // Recalculate course average rating
    await recalculateCourseRating(courseId)

    return res.status(200).json({
        success: true,
        message: review.createdAt.getTime() === review.updatedAt.getTime() 
            ? "Review submitted successfully" 
            : "Review updated successfully",
        data: review
    })
})

/**
 * Get all reviews for a course (public)
 * GET /api/reviews/:courseId
 */
export const getCourseReviews = asyncHandler(async (req: Request, res: Response) => {
    const courseId = Number(req.params.courseId)
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit

    if (!courseId || isNaN(courseId)) {
        throw new ApiError(400, "Invalid course ID")
    }

    const [reviews, totalReviews] = await Promise.all([
        prisma.review.findMany({
            where: { courseId },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { firstName: true, lastName: true }
                }
            }
        }),
        prisma.review.count({ where: { courseId } })
    ])

    return res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        data: {
            reviews,
            totalReviews,
            totalPages: Math.ceil(totalReviews / limit),
            currentPage: page,
            limit
        }
    })
})

/**
 * Get current user's review for a course
 * GET /api/reviews/user/:courseId
 */
export const getUserReview = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id)
    const courseId = Number(req.params.courseId)

    if (!courseId || isNaN(courseId)) {
        throw new ApiError(400, "Invalid course ID")
    }

    const review = await prisma.review.findUnique({
        where: {
            userId_courseId: { userId, courseId }
        }
    })

    return res.status(200).json({
        success: true,
        message: review ? "Review found" : "No review found",
        data: review
    })
})

/**
 * Delete a review (admin only)
 * DELETE /api/reviews/:reviewId
 */
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const reviewId = Number(req.params.reviewId)

    if (!reviewId || isNaN(reviewId)) {
        throw new ApiError(400, "Invalid review ID")
    }

    // Find the review first to get courseId
    const review = await prisma.review.findUnique({
        where: { id: reviewId }
    })

    if (!review) {
        throw new ApiError(404, "Review not found")
    }

    const courseId = review.courseId

    // Delete the review
    await prisma.review.delete({
        where: { id: reviewId }
    })

    // Recalculate course average rating
    await recalculateCourseRating(courseId)

    return res.status(200).json({
        success: true,
        message: "Review deleted successfully"
    })
})

/**
 * Get all reviews for admin management (paginated)
 * GET /api/reviews/admin/all
 */
export const getAllReviewsForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [reviews, totalReviews] = await Promise.all([
        prisma.review.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                },
                course: {
                    select: { id: true, title: true, thumbnail: true }
                }
            }
        }),
        prisma.review.count()
    ])

    const totalPages = Math.ceil(totalReviews / limit)

    return res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        data: {
            reviews,
            pagination: {
                totalReviews,
                totalPages,
                currentPage: page,
                limit
            }
        }
    })
})
