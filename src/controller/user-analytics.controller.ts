import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { getCache, setCache } from "../utils/cache";
import { slugify } from "../utils/slugify.utils";
import { BaseDashboardAnalytics, MonthlyData, RecentOrder, QuizAnalytics, CourseQuizStats } from "./dashboard.controller";
import { ApiError } from "../utils/api_error.utils";

const USER_ANALYTICS_CACHE_TTL = 300; // 5 minutes

function formatMonthYear(date: Date): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDayMonth(date: Date): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
}

function getTwelveMonthsAgo(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getThirtyDaysAgo(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    date.setHours(0, 0, 0, 0);
    return date;
}

function generateMonthsArray(): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(formatMonthYear(date));
    }
    return months;
}

function generateLast30DaysArray(): string[] {
    const days: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        days.push(formatDayMonth(date));
    }
    return days;
}

// Extend BaseDashboardAnalytics (without coupon analytics)
export interface UserDashboardAnalytics extends BaseDashboardAnalytics {
    user: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        createdAt: Date;
        lastLogin: Date | null;
        isBlocked: boolean;
        isActive: boolean;
    }
}

export const getUserAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId || "");

    if (isNaN(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const cacheKey = `user-analytics:${userId}`;
    const cached = await getCache<UserDashboardAnalytics>(cacheKey);
    if (cached) {
        return res.success("User analytics fetched from cache", cached);
    }

    // Verify user exists first
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            role: true, 
            createdAt: true,
            isBlocked: true,
            isActive: true
            // we don't track last login explicitly in user table yet, maybe add later? 
            // defaulting to null for now as per schema
        }
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const twelveMonthsAgo = getTwelveMonthsAgo();
    const thirtyDaysAgo = getThirtyDaysAgo();
    const monthsArray = generateMonthsArray();
    const daysArray = generateLast30DaysArray();

    const [
        totalEnrollments,
        totalCertificates,
        completedOrders,
        enrollments,
        certificates,
        recentOrdersRaw,
        quizAttemptsByMonth,
        quizCount,
        quizAvg,
        quizGrouped
    ] = await prisma.$transaction([
        prisma.enrollment.count({ where: { userId } }),
        prisma.certificate.count({ where: { userId } }),
        prisma.order.findMany({
            where: { userId, status: "COMPLETED", createdAt: { gte: twelveMonthsAgo } },
            select: { amount: true, createdAt: true }
        }),
        prisma.enrollment.findMany({
            where: { userId, createdAt: { gte: twelveMonthsAgo } },
            select: { createdAt: true }
        }),
        prisma.certificate.findMany({
            where: { userId, issuedAt: { gte: twelveMonthsAgo } },
            select: { issuedAt: true }
        }),
        prisma.order.findMany({
            where: { userId, status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                courseId: true,
                userId: true,
                course: { select: { title: true } },
                user: { select: { firstName: true, lastName: true, email: true } }
            }
        }),
        prisma.quizAttempt.findMany({
            where: { userId, createdAt: { gte: twelveMonthsAgo } },
            select: { createdAt: true }
        }),
        prisma.quizAttempt.count({ where: { userId } }),
        prisma.quizAttempt.aggregate({
            where: { userId },
            _avg: { score: true }
        }),
        prisma.quizAttempt.groupBy({
            by: ['quizId'],
            where: { userId },
            _count: { _all: true },
            _avg: { score: true },
            orderBy: { quizId: 'asc' }
        })
    ]);

    // Aggregate Revenue (Spending for User)
    const revenueMap = new Map<string, number>();
    monthsArray.forEach(month => revenueMap.set(month, 0));
    
    const revenueDayMap = new Map<string, number>();
    daysArray.forEach(day => revenueDayMap.set(day, 0));

    let totalSpent = 0;

    // For user, revenue = spending
    completedOrders.forEach(order => {
        totalSpent += order.amount;
        const month = formatMonthYear(order.createdAt);
        if (revenueMap.has(month)) {
            revenueMap.set(month, (revenueMap.get(month) || 0) + order.amount);
        }
        
        if (order.createdAt >= thirtyDaysAgo) {
            const day = formatDayMonth(order.createdAt);
            if (revenueDayMap.has(day)) {
                revenueDayMap.set(day, (revenueDayMap.get(day) || 0) + order.amount);
            }
        }
    });

    const revenueByMonth = monthsArray.map(month => ({
        month,
        value: revenueMap.get(month) || 0
    }));

    const revenueByDay = daysArray.map(day => ({
        month: day,
        value: revenueDayMap.get(day) || 0
    }));

    // Enrollments
    const enrollmentsMap = new Map<string, number>();
    monthsArray.forEach(month => enrollmentsMap.set(month, 0));

    const enrollmentsDayMap = new Map<string, number>();
    daysArray.forEach(day => enrollmentsDayMap.set(day, 0));

    enrollments.forEach(enrollment => {
        const month = formatMonthYear(enrollment.createdAt);
        if (enrollmentsMap.has(month)) {
            enrollmentsMap.set(month, (enrollmentsMap.get(month) || 0) + 1);
        }

        if (enrollment.createdAt >= thirtyDaysAgo) {
            const day = formatDayMonth(enrollment.createdAt);
            if (enrollmentsDayMap.has(day)) {
                enrollmentsDayMap.set(day, (enrollmentsDayMap.get(day) || 0) + 1);
            }
        }
    });

    const enrollmentsByMonth = monthsArray.map(month => ({
        month,
        value: enrollmentsMap.get(month) || 0
    }));

    const enrollmentsByDay = daysArray.map(day => ({
        month: day,
        value: enrollmentsDayMap.get(day) || 0
    }));

    // Certificates
    const certsMap = new Map<string, number>();
    monthsArray.forEach(month => certsMap.set(month, 0));

    const certsDayMap = new Map<string, number>();
    daysArray.forEach(day => certsDayMap.set(day, 0));

    certificates.forEach(cert => {
        const month = formatMonthYear(cert.issuedAt);
        if (certsMap.has(month)) {
            certsMap.set(month, (certsMap.get(month) || 0) + 1);
        }

        if (cert.issuedAt >= thirtyDaysAgo) {
            const day = formatDayMonth(cert.issuedAt);
            if (certsDayMap.has(day)) {
                certsDayMap.set(day, (certsDayMap.get(day) || 0) + 1);
            }
        }
    });

    const certificatesByMonth = monthsArray.map(month => ({
        month,
        value: certsMap.get(month) || 0
    }));

    const certificatesByDay = daysArray.map(day => ({
        month: day,
        value: certsDayMap.get(day) || 0
    }));

    // Recent Orders
    const recentOrders: RecentOrder[] = recentOrdersRaw.map(order => ({
        id: order.id,
        courseId: order.courseId,
        // @ts-ignore
        courseName: order.course.title,
        // @ts-ignore
        courseSlug: slugify(order.course.title),
        userId: order.userId,
        // @ts-ignore
        userName: `${order.user.firstName} ${order.user.lastName}`,
        // @ts-ignore
        userEmail: order.user.email,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt,
        couponCode: null,
        discountAmount: null
    }));

    // Quiz Analytics
    const totalAttempts = quizCount;
    const avgScore = quizAvg._avg.score ? Math.round(quizAvg._avg.score) : 0;

    const attemptsMap = new Map<string, number>();
    monthsArray.forEach(month => attemptsMap.set(month, 0));

    const attemptsDayMap = new Map<string, number>();
    daysArray.forEach(day => attemptsDayMap.set(day, 0));

    quizAttemptsByMonth.forEach(attempt => {
        const month = formatMonthYear(attempt.createdAt);
        if (attemptsMap.has(month)) {
            attemptsMap.set(month, (attemptsMap.get(month) || 0) + 1);
        }

        if (attempt.createdAt >= thirtyDaysAgo) {
            const day = formatDayMonth(attempt.createdAt);
            if (attemptsDayMap.has(day)) {
                attemptsDayMap.set(day, (attemptsDayMap.get(day) || 0) + 1);
            }
        }
    });

    const attemptsByMonth = monthsArray.map(month => ({
        month,
        value: attemptsMap.get(month) || 0
    }));

    const attemptsByDay = daysArray.map(day => ({
        month: day,
        value: attemptsDayMap.get(day) || 0
    }));

    // Per-course quiz stats
    const quizIds = quizGrouped.map(g => g.quizId);
    
    // Fetch unique quizzes
    const quizzes = await prisma.quize.findMany({
        where: { id: { in: quizIds } },
        select: {
            id: true,
            section: {
                select: {
                    course: { select: { id: true, title: true } }
                }
            }
        }
    });

    const quizMap = new Map(quizzes.map(q => [q.id, q]));
    const courseStatsMap = new Map<number, { name: string, attempts: number, totalScore: number }>();

    quizGrouped.forEach(group => {
        const quiz = quizMap.get(group.quizId);
        if (quiz && quiz.section && quiz.section.course) {
            const course = quiz.section.course;
            const courseId = course.id;
            
            if (!courseStatsMap.has(courseId)) {
                courseStatsMap.set(courseId, { name: course.title, attempts: 0, totalScore: 0 });
            }
            
            const stats = courseStatsMap.get(courseId)!;
            // @ts-ignore
            const count = group._count._all as number;
            // @ts-ignore
            const avg = group._avg.score || 0;
            
            stats.attempts += count;
            stats.totalScore += (avg * count);
        }
    });

    const byCourse: CourseQuizStats[] = Array.from(courseStatsMap.entries())
        .map(([courseId, stats]) => ({
            courseId,
            courseName: stats.name,
            attempts: stats.attempts,
            avgScore: stats.attempts > 0 ? Math.round(stats.totalScore / stats.attempts) : 0
        }))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 10);

    const quizAnalytics: QuizAnalytics = {
        totalAttempts,
        avgScore,
        attemptsByMonth,
        attemptsByDay,
        byCourse
    };

    const analytics: UserDashboardAnalytics = {
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: null, // Placeholder
            isBlocked: user.isBlocked,
            isActive: user.isActive
        },
        totalUsers: 1, // Scoped to 1 user
        totalStudents: user.role === 'STUDENT' ? 1 : 0,
        totalCourses: 0, // Not applicable
        totalEnrollments,
        totalCertificates,
        totalRevenue: totalSpent,
        revenueByMonth,
        revenueByDay,
        userRegistrationsByMonth: [], // Not applicable
        userRegistrationsByDay: [], // Not applicable
        enrollmentsByMonth,
        enrollmentsByDay,
        certificatesByMonth,
        certificatesByDay,
        recentOrders,
        quizAnalytics
    };

    await setCache(cacheKey, analytics, USER_ANALYTICS_CACHE_TTL);
    return res.success("User analytics fetched", analytics);
});
