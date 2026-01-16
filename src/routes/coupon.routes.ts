// Coupon Routes
import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCouponCode
} from "../controller/coupon.controller";

const router = Router();

// Admin routes - require admin access
router.post("/admin/coupons", isAuthenticated, isAdmin, createCoupon);
router.get("/admin/coupons", isAuthenticated, isAdmin, getAllCoupons);
router.get("/admin/coupons/:id", isAuthenticated, isAdmin, getCouponById);
router.patch("/admin/coupons/:id", isAuthenticated, isAdmin, updateCoupon);
router.delete("/admin/coupons/:id", isAuthenticated, isAdmin, deleteCoupon);

// User routes - require authentication
router.post("/coupons/validate", isAuthenticated, validateCouponCode);

export default router;
