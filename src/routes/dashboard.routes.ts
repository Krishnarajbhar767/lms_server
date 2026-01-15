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
