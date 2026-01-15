import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { getCache, setCache, DASHBOARD_CACHE_KEY } from "../utils/cache";

const DASHBOARD_CACHE_TTL = 300;

interface MonthlyData {
    month: string;
    value: number;
}

interface RecentOrder {
    id: number;
    courseName: string;
    userName: string;
    amount: number;
    status: string;
    createdAt: Date;
}

interface CourseQuizStats {
    courseId: number;
    courseName: string;
    attempts: number;
    avgScore: number;
}

interface QuizAnalytics {
    totalAttempts: number;
    avgScore: number;
    attemptsByMonth: MonthlyData[];
    attemptsByDay: MonthlyData[];
    byCourse: CourseQuizStats[];
}

interface DashboardAnalytics {
    totalUsers: number;
    totalStudents: number;
    totalCourses: number;
    totalEnrollments: number;
    totalCertificates: number;
    totalRevenue: number;
    revenueByMonth: MonthlyData[];
    revenueByDay: MonthlyData[];
    userRegistrationsByMonth: MonthlyData[];
    userRegistrationsByDay: MonthlyData[];
    enrollmentsByMonth: MonthlyData[];
    enrollmentsByDay: MonthlyData[];
    certificatesByMonth: MonthlyData[];
    certificatesByDay: MonthlyData[];
    recentOrders: RecentOrder[];
    quizAnalytics: QuizAnalytics;
}

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

export const getDashboardAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const cached = await getCache<DashboardAnalytics>(DASHBOARD_CACHE_KEY);
    if (cached) {
        return res.success("Dashboard analytics fetched from cache", cached);
    }

    const twelveMonthsAgo = getTwelveMonthsAgo();
    const thirtyDaysAgo = getThirtyDaysAgo();
    const monthsArray = generateMonthsArray();
    const daysArray = generateLast30DaysArray();

    const [
        totalUsers,
        totalStudents,
        totalCourses,
        totalEnrollments,
        totalCertificates,
        revenueResult,
        completedOrders,
        userRegistrations,
        enrollments,
        certificates,
        recentOrdersRaw,
        quizAttemptsByMonth, // Keep specific date-filtered fetch for charts
        quizCount,           // New: Global count
        quizAvg,             // New: Global average
        quizGrouped          // New: Grouped by quizId
    ] = await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.course.count({ where: { status: "PUBLISHED" } }),
        prisma.enrollment.count(),
        prisma.certificate.count(),
        prisma.order.aggregate({
            where: { status: "COMPLETED" },
            _sum: { amount: true }
        }),
        prisma.order.findMany({
            where: { status: "COMPLETED", createdAt: { gte: twelveMonthsAgo } },
            select: { amount: true, createdAt: true }
        }),
        prisma.user.findMany({
            where: { createdAt: { gte: twelveMonthsAgo } },
            select: { createdAt: true }
        }),
        prisma.enrollment.findMany({
            where: { createdAt: { gte: twelveMonthsAgo } },
            select: { createdAt: true }
        }),
        prisma.certificate.findMany({
            where: { issuedAt: { gte: twelveMonthsAgo } },
            select: { issuedAt: true }
        }),
        prisma.order.findMany({
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                course: { select: { title: true } },
                user: { select: { firstName: true, lastName: true } }
            }
        }),
        prisma.quizAttempt.findMany({
            where: { createdAt: { gte: twelveMonthsAgo } },
            select: { createdAt: true }
        }),
        prisma.quizAttempt.count(),
        prisma.quizAttempt.aggregate({
            _avg: { score: true }
        }),
        prisma.quizAttempt.groupBy({
            by: ['quizId'],
            _count: { _all: true },
            _avg: { score: true },
            orderBy: { quizId: 'asc' }
        })
    ]);

    // aggregate revenue by month
    const revenueMap = new Map<string, number>();
    monthsArray.forEach(month => revenueMap.set(month, 0));
    
    // aggregate revenue by day
    const revenueDayMap = new Map<string, number>();
    daysArray.forEach(day => revenueDayMap.set(day, 0));

    completedOrders.forEach(order => {
        const month = formatMonthYear(order.createdAt);
        if (revenueMap.has(month)) {
            revenueMap.set(month, (revenueMap.get(month) || 0) + order.amount);
        }
        
        // check if order is within last 30 days
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
        month: day, // reusing 'month' key for compatibility with chart component structure
        value: revenueDayMap.get(day) || 0
    }));

    // aggregate user registrations by month and day
    const usersMap = new Map<string, number>();
    monthsArray.forEach(month => usersMap.set(month, 0));

    const usersDayMap = new Map<string, number>();
    daysArray.forEach(day => usersDayMap.set(day, 0));

    userRegistrations.forEach(user => {
        const month = formatMonthYear(user.createdAt);
        if (usersMap.has(month)) {
            usersMap.set(month, (usersMap.get(month) || 0) + 1);
        }

        if (user.createdAt >= thirtyDaysAgo) {
            const day = formatDayMonth(user.createdAt);
            if (usersDayMap.has(day)) {
                usersDayMap.set(day, (usersDayMap.get(day) || 0) + 1);
            }
        }
    });

    const userRegistrationsByMonth = monthsArray.map(month => ({
        month,
        value: usersMap.get(month) || 0
    }));

    const userRegistrationsByDay = daysArray.map(day => ({
        month: day,
        value: usersDayMap.get(day) || 0
    }));

    // aggregate enrollments by month and day
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

    // aggregate certificates by month and day
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

    // format recent orders
    const recentOrders: RecentOrder[] = recentOrdersRaw.map(order => ({
        id: order.id,
        courseName: order.course.title,
        userName: `${order.user.firstName} ${order.user.lastName}`,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt
    }));

    // quiz analytics
    const totalAttempts = quizCount;
    const avgScore = quizAvg._avg.score ? Math.round(quizAvg._avg.score) : 0;

    // quiz attempts by month and day
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

    // per-course quiz stats - optimize to avoid huge fetch
    // fetch quiz details for the quizzes we have stats for
    const quizIds = quizGrouped.map(g => g.quizId);
    
    // In a real optimized scenario, we'd limit this or do it better, 
    // but fetching details for unique quizes is better than all attempts
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

    const analytics: DashboardAnalytics = {
        totalUsers,
        totalStudents,
        totalCourses,
        totalEnrollments,
        totalCertificates,
        totalRevenue: revenueResult._sum.amount || 0,
        revenueByMonth,
        revenueByDay,
        userRegistrationsByMonth,
        userRegistrationsByDay,
        enrollmentsByMonth,
        enrollmentsByDay,
        certificatesByMonth,
        certificatesByDay,
        recentOrders,
        quizAnalytics
    };

    await setCache(DASHBOARD_CACHE_KEY, analytics, DASHBOARD_CACHE_TTL);
    return res.success("Dashboard analytics fetched", analytics);
});
