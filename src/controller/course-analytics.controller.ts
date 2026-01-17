import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { getCache, setCache } from "../utils/cache";
import { ApiError } from "../utils/api_error.utils";

const COURSE_ANALYTICS_CACHE_TTL = 300; // 5 minutes

export interface CourseAnalytics {
    course: {
        id: number;
        title: string;
        thumbnail: string;
        status: string;
        createdAt: Date;
    };
    metrics: {
        totalEnrollments: number;
        totalCertificates: number;
        totalOrders: number;
        totalRevenue: number;
        totalDiscounts: number;
        ordersWithCoupons: number;
        averageRating: number | null;
        totalReviews: number;
    };
    recentEnrollments: Array<{
        id: number;
        userId: number;
        userName: string;
        userEmail: string;
        createdAt: Date;
    }>;
    recentReviews: Array<{
        id: number;
        userId: number;
        userName: string;
        userEmail: string;
        rating: number;
        comment: string | null;
        createdAt: Date;
    }>;
    recentOrders: Array<{
        id: number;
        userId: number;
        userName: string;
        userEmail: string;
        amount: number;
        status: string;
        couponCode: string | null;
        discountAmount: number | null;
        createdAt: Date;
    }>;
}

export const getCourseAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.courseId || "");

    if (isNaN(courseId)) {
        throw new ApiError(400, "Invalid course ID");
    }

    const cacheKey = `course-analytics:${courseId}`;
    const cached = await getCache<CourseAnalytics>(cacheKey);
    if (cached) {
        return res.success("Course analytics fetched from cache", cached);
    }

    // Verify course exists
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            id: true,
            title: true,
            thumbnail: true,
            status: true,
            createdAt: true
        }
    });

    if (!course) {
        throw new ApiError(404, "Course not found");
    }

    const [
        totalEnrollments,
        totalCertificates,
        completedOrders,
        totalDiscounts,
        ordersWithCoupons,
        reviews,
        recentEnrollmentsRaw,
        recentReviewsRaw,
        recentOrdersRaw
    ] = await prisma.$transaction([
        // Total enrollments
        prisma.enrollment.count({
            where: { courseId }
        }),

        // Total certificates
        prisma.certificate.count({
            where: { courseId }
        }),

        // Completed orders for revenue
        prisma.order.findMany({
            where: { courseId, status: "COMPLETED" },
            select: { amount: true }
        }),

        // Total discounts
        prisma.order.aggregate({
            where: {
                courseId,
                status: "COMPLETED",
                discountAmount: { not: null }
            },
            _sum: { discountAmount: true }
        }),

        // Orders with coupons
        prisma.order.count({
            where: {
                courseId,
                status: "COMPLETED",
                couponCode: { not: null }
            }
        }),

        // Reviews for average rating
        prisma.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
            _count: true
        }),

        // Recent enrollments
        prisma.enrollment.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                userId: true,
                createdAt: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        }),

        // Recent reviews
        prisma.review.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                userId: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        }),

        // Recent orders
        prisma.order.findMany({
            where: { courseId, status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                userId: true,
                amount: true,
                status: true,
                couponCode: true,
                discountAmount: true,
                createdAt: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        })
    ]);

    // Calculate metrics
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const totalOrders = completedOrders.length;

    // Format response
    const analytics: CourseAnalytics = {
        course: {
            id: course.id,
            title: course.title,
            thumbnail: course.thumbnail,
            status: course.status,
            createdAt: course.createdAt
        },
        metrics: {
            totalEnrollments,
            totalCertificates,
            totalOrders,
            totalRevenue,
            totalDiscounts: totalDiscounts._sum.discountAmount || 0,
            ordersWithCoupons,
            averageRating: reviews._avg.rating,
            totalReviews: reviews._count
        },
        recentEnrollments: recentEnrollmentsRaw.map(e => ({
            id: e.id,
            userId: e.userId,
            userName: `${e.user.firstName} ${e.user.lastName}`,
            userEmail: e.user.email,
            createdAt: e.createdAt
        })),
        recentReviews: recentReviewsRaw.map(r => ({
            id: r.id,
            userId: r.userId,
            userName: `${r.user.firstName} ${r.user.lastName}`,
            userEmail: r.user.email,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt
        })),
        recentOrders: recentOrdersRaw.map(o => ({
            id: o.id,
            userId: o.userId,
            userName: `${o.user.firstName} ${o.user.lastName}`,
            userEmail: o.user.email,
            amount: o.amount,
            status: o.status,
            couponCode: o.couponCode,
            discountAmount: o.discountAmount,
            createdAt: o.createdAt
        }))
    };

    // Cache result
    await setCache(cacheKey, analytics, COURSE_ANALYTICS_CACHE_TTL);

    return res.success("Course analytics fetched", analytics);
});
