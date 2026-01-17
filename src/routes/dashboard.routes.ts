import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { getDashboardAnalytics } from "../controller/dashboard.controller";

export const dashboardRouter = Router();

// admin dashboard analytics endpoint
// returns kpis and chart data for dashboard
dashboardRouter.get(
    "/dashboard",
    isAuthenticated,
    isAdmin,
    getDashboardAnalytics
);

import { getUserAnalytics } from "../controller/user-analytics.controller";

// admin user specific analytics endpoint
dashboardRouter.get(
    "/users/:userId/analytics",
    isAuthenticated,
    isAdmin,
    getUserAnalytics
);

import { getCourseAnalytics } from "../controller/course-analytics.controller";

// admin course specific analytics endpoint
dashboardRouter.get(
    "/courses/:courseId/analytics",
    isAuthenticated,
    isAdmin,
    getCourseAnalytics
);
