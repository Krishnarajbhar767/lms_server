// Coupon Service - Business Logic for Coupon Validation and Consumption
// Safe implementation with feature flag support

import { prisma } from "../prisma";
import { DiscountType } from "@prisma/client";
import { logger } from "../config/logger.config";

// Feature flag - can be disabled via environment
const COUPON_SYSTEM_ENABLED = process.env.COUPON_SYSTEM_ENABLED?.toLowerCase().trim() !== "false";

// Validation result types
export interface CouponValidationResult {
    valid: boolean;
    reason?: string;
    message?: string;
    couponCode?: string;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount?: number;
    finalAmount?: number;
}

// Validation error reasons
const VALIDATION_ERRORS = {
    DISABLED: "Coupon system is currently disabled",
    NOT_FOUND: "Invalid coupon code",
    EXPIRED: "This coupon has expired",
    NOT_STARTED: "This coupon is not yet active",
    LIMIT_EXCEEDED: "This coupon has reached its usage limit",
    USER_LIMIT_EXCEEDED: "You have already used this coupon",
    NOT_APPLICABLE: "This coupon is not applicable to this course",
    MIN_ORDER_NOT_MET: "Minimum order amount not met for this coupon",
    INACTIVE: "This coupon is no longer active"
};

/**
 * Validate a coupon code for a specific order
 * All validation happens on backend - never trust frontend
 */
export async function validateCoupon(
    code: string,
    userId: number,
    courseId: number,
    orderAmount: number
): Promise<CouponValidationResult> {
    // Feature flag check
    if (!COUPON_SYSTEM_ENABLED) {
        logger.warn("[Coupon] System disabled via feature flag");
        return { valid: false, reason: "DISABLED", message: VALIDATION_ERRORS.DISABLED };
    }

    // Normalize code
    const normalizedCode = code.trim().toUpperCase();

    logger.info(`[Coupon] Validating code: ${normalizedCode} for user: ${userId}, course: ${courseId}, amount: ${orderAmount}`);

    try {
        // 1. Find coupon (case-insensitive via normalized code)
        const coupon = await prisma.coupon.findFirst({
            where: { code: normalizedCode }
        });

        if (!coupon) {
            logger.info(`[Coupon] Not found: ${normalizedCode}`);
            return { valid: false, reason: "NOT_FOUND", message: VALIDATION_ERRORS.NOT_FOUND };
        }

        // 2. Check if active
        if (!coupon.isActive) {
            logger.info(`[Coupon] Inactive: ${normalizedCode}`);
            return { valid: false, reason: "INACTIVE", message: VALIDATION_ERRORS.INACTIVE };
        }

        // 3. Check date validity
        const now = new Date();
        if (coupon.validFrom > now) {
            logger.info(`[Coupon] Not started yet: ${normalizedCode}`);
            return { valid: false, reason: "NOT_STARTED", message: VALIDATION_ERRORS.NOT_STARTED };
        }

        if (coupon.validTill && coupon.validTill < now) {
            logger.info(`[Coupon] Expired: ${normalizedCode}`);
            return { valid: false, reason: "EXPIRED", message: VALIDATION_ERRORS.EXPIRED };
        }

        // 4. Check global usage limit
        if (coupon.totalUsageLimit !== null && coupon.usedCount >= coupon.totalUsageLimit) {
            logger.info(`[Coupon] Global limit exceeded: ${normalizedCode}`);
            return { valid: false, reason: "LIMIT_EXCEEDED", message: VALIDATION_ERRORS.LIMIT_EXCEEDED };
        }

        // 5. Check per-user usage limit
        const userUsageCount = await prisma.couponUsage.count({
            where: { couponId: coupon.id, userId }
        });

        if (userUsageCount >= coupon.perUserLimit) {
            logger.info(`[Coupon] User limit exceeded: ${normalizedCode} for user: ${userId}`);
            return { valid: false, reason: "USER_LIMIT_EXCEEDED", message: VALIDATION_ERRORS.USER_LIMIT_EXCEEDED };
        }

        // 6. Check minimum order amount
        if (coupon.minOrderAmount !== null && orderAmount < coupon.minOrderAmount) {
            logger.info(`[Coupon] Min order not met: ${normalizedCode}, required: ${coupon.minOrderAmount}, got: ${orderAmount}`);
            return { 
                valid: false, 
                reason: "MIN_ORDER_NOT_MET", 
                message: `Minimum order amount of ₹${coupon.minOrderAmount} required` 
            };
        }

        // 7. Calculate discount
        let discountAmount: number;

        if (coupon.discountType === "PERCENTAGE") {
            discountAmount = (orderAmount * coupon.discountValue) / 100;
            // Apply max discount cap if set
            if (coupon.maxDiscountAmount !== null) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
            }
        } else {
            // Fixed amount
            discountAmount = coupon.discountValue;
        }

        // 8. Ensure discount does not exceed order amount
        discountAmount = Math.min(discountAmount, orderAmount);

        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;
        const finalAmount = Math.round((orderAmount - discountAmount) * 100) / 100;

        logger.info(`[Coupon] Valid: ${normalizedCode}, discount: ${discountAmount}, final: ${finalAmount}`);

        return {
            valid: true,
            couponCode: normalizedCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount,
            finalAmount,
            message: "Coupon applied successfully"
        };

    } catch (error) {
        logger.error("[Coupon] Validation error:", error);
        return { valid: false, reason: "ERROR", message: "Failed to validate coupon" };
    }
}

/**
 * Consume a coupon after successful payment
 * This is called ONLY after payment verification succeeds
 * Uses transaction for atomicity
 */
export async function consumeCoupon(
    couponCode: string,
    userId: number,
    orderId: number
): Promise<boolean> {
    if (!COUPON_SYSTEM_ENABLED) {
        return false;
    }

    const normalizedCode = couponCode.trim().toUpperCase();

    logger.info(`[Coupon] Consuming: ${normalizedCode} for order: ${orderId}`);

    try {
        // Use transaction for atomic update
        await prisma.$transaction(async (tx) => {
            // Find coupon
            const coupon = await tx.coupon.findFirst({
                where: { code: normalizedCode }
            });

            if (!coupon) {
                logger.warn(`[Coupon] Not found during consume: ${normalizedCode}`);
                return;
            }

            // Check if already consumed for this order (prevent double consumption)
            const existingUsage = await tx.couponUsage.findUnique({
                where: { orderId }
            });

            if (existingUsage) {
                logger.warn(`[Coupon] Already consumed for order: ${orderId}`);
                return;
            }

            // Increment usage count
            await tx.coupon.update({
                where: { id: coupon.id },
                data: { usedCount: { increment: 1 } }
            });

            // Record usage
            await tx.couponUsage.create({
                data: {
                    couponId: coupon.id,
                    userId,
                    orderId
                }
            });

            logger.info(`[Coupon] Consumed successfully: ${normalizedCode} for order: ${orderId}`);
        });

        return true;
    } catch (error) {
        logger.error("[Coupon] Consumption error:", error);
        return false;
    }
}

/**
 * Get coupon statistics for admin dashboard
 */
export async function getCouponStats(couponId: number) {
    const coupon = await prisma.coupon.findUnique({
        where: { id: couponId },
        include: {
            usages: {
                take: 10,
                orderBy: { usedAt: "desc" }
            }
        }
    });

    if (!coupon) return null;

    return {
        ...coupon,
        remainingUses: coupon.totalUsageLimit 
            ? coupon.totalUsageLimit - coupon.usedCount 
            : null
    };
}
