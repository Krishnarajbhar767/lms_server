import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { getCache, setCache, DASHBOARD_CACHE_KEY } from "../utils/cache";

// short ttl of 5 minutes for dashboard analytics
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

interface DashboardAnalytics {
    totalUsers: number;
    totalStudents: number;
    totalCourses: number;
    totalEnrollments: number;
    totalRevenue: number;
    revenueByMonth: MonthlyData[];
    userRegistrationsByMonth: MonthlyData[];
    enrollmentsByMonth: MonthlyData[];
    recentOrders: RecentOrder[];
}

// helper to format date as mon yyyy for example jan 2026
function formatMonthYear(date: Date): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// helper to get date 6 months ago from now
function getSixMonthsAgo(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
}

// helper to generate empty months array for last 6 months for chart defaults
function generateMonthsArray(): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(formatMonthYear(date));
    }
    return months;
}

// main dashboard analytics endpoint
export const getDashboardAnalytics = asyncHandler(async (req: Request, res: Response) => {
    // check cache first for performance
    const cached = await getCache<DashboardAnalytics>(DASHBOARD_CACHE_KEY);
    if (cached) {
        return res.success("Dashboard analytics fetched from cache", cached);
    }

    const sixMonthsAgo = getSixMonthsAgo();
    const monthsArray = generateMonthsArray();

    // run all count queries in parallel for better performance
    const [
        totalUsers,
        totalStudents,
        totalCourses,
        totalEnrollments,
        revenueResult,
        completedOrders,
        userRegistrations,
        enrollments,
        recentOrdersRaw
    ] = await Promise.all([
        // total users count
        prisma.user.count(),
        
        // total students count
        prisma.user.count({
            where: { role: "STUDENT" }
        }),
        
        // total published courses count
        prisma.course.count({
            where: { status: "PUBLISHED" }
        }),
        
        // total enrollments count
        prisma.enrollment.count(),
        
        // total revenue from completed orders
        prisma.order.aggregate({
            where: { status: "COMPLETED" },
            _sum: { amount: true }
        }),
        
        // completed orders in last 6 months for revenue chart
        prisma.order.findMany({
            where: {
                status: "COMPLETED",
                createdAt: { gte: sixMonthsAgo }
            },
            select: {
                amount: true,
                createdAt: true
            }
        }),
        
        // user registrations in last 6 months for growth chart
        prisma.user.findMany({
            where: {
                createdAt: { gte: sixMonthsAgo }
            },
            select: {
                createdAt: true
            }
        }),
        
        // enrollments in last 6 months for enrollments chart
        prisma.enrollment.findMany({
            where: {
                createdAt: { gte: sixMonthsAgo }
            },
            select: {
                createdAt: true
            }
        }),
        
        // recent 10 orders with course and user info
        prisma.order.findMany({
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                course: {
                    select: { title: true }
                },
                user: {
                    select: { firstName: true, lastName: true }
                }
            }
        })
    ]);

    // aggregate revenue by month
    const revenueMap = new Map<string, number>();
    monthsArray.forEach(month => revenueMap.set(month, 0));
    completedOrders.forEach(order => {
        const month = formatMonthYear(order.createdAt);
        if (revenueMap.has(month)) {
            revenueMap.set(month, (revenueMap.get(month) || 0) + order.amount);
        }
    });
    const revenueByMonth = monthsArray.map(month => ({
        month,
        value: revenueMap.get(month) || 0
    }));

    // aggregate user registrations by month
    const usersMap = new Map<string, number>();
    monthsArray.forEach(month => usersMap.set(month, 0));
    userRegistrations.forEach(user => {
        const month = formatMonthYear(user.createdAt);
        if (usersMap.has(month)) {
            usersMap.set(month, (usersMap.get(month) || 0) + 1);
        }
    });
    const userRegistrationsByMonth = monthsArray.map(month => ({
        month,
        value: usersMap.get(month) || 0
    }));

    // aggregate enrollments by month
    const enrollmentsMap = new Map<string, number>();
    monthsArray.forEach(month => enrollmentsMap.set(month, 0));
    enrollments.forEach(enrollment => {
        const month = formatMonthYear(enrollment.createdAt);
        if (enrollmentsMap.has(month)) {
            enrollmentsMap.set(month, (enrollmentsMap.get(month) || 0) + 1);
        }
    });
    const enrollmentsByMonth = monthsArray.map(month => ({
        month,
        value: enrollmentsMap.get(month) || 0
    }));

    // format recent orders for response
    const recentOrders: RecentOrder[] = recentOrdersRaw.map(order => ({
        id: order.id,
        courseName: order.course.title,
        userName: `${order.user.firstName} ${order.user.lastName}`,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt
    }));

    const analytics: DashboardAnalytics = {
        totalUsers,
        totalStudents,
        totalCourses,
        totalEnrollments,
        totalRevenue: revenueResult._sum.amount || 0,
        revenueByMonth,
        userRegistrationsByMonth,
        enrollmentsByMonth,
        recentOrders
    };

    // cache the result with short ttl
    await setCache(DASHBOARD_CACHE_KEY, analytics, DASHBOARD_CACHE_TTL);

    return res.success("Dashboard analytics fetched", analytics);
});
