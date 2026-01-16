// Coupon Controller - API endpoints for coupon management and validation
import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { ApiError } from "../utils/api_error.utils";
import { prisma } from "../prisma";
import { validateCoupon, getCouponStats } from "../services/coupon.service";
import { DiscountType } from "@prisma/client";

// Admin: Create a new coupon
export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
    const {
        code,
        discountType,
        discountValue,
        maxDiscountAmount,
        minOrderAmount,
        totalUsageLimit,
        perUserLimit,
        validFrom,
        validTill,
        isActive
    } = req.body;

    // Validate required fields
    if (!code || !discountType || discountValue === undefined) {
        throw new ApiError(400, "Code, discountType, and discountValue are required");
    }

    // Validate discount type
    if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
        throw new ApiError(400, "discountType must be PERCENTAGE or FIXED");
    }

    // Validate discount value
    if (discountValue <= 0) {
        throw new ApiError(400, "discountValue must be greater than 0");
    }

    if (discountType === "PERCENTAGE" && discountValue > 100) {
        throw new ApiError(400, "Percentage discount cannot exceed 100%");
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase();

    // Check if code already exists
    const existingCoupon = await prisma.coupon.findFirst({
        where: { code: normalizedCode }
    });

    if (existingCoupon) {
        throw new ApiError(400, "Coupon code already exists");
    }

    const coupon = await prisma.coupon.create({
        data: {
            code: normalizedCode,
            discountType: discountType as DiscountType,
            discountValue,
            maxDiscountAmount: maxDiscountAmount || null,
            minOrderAmount: minOrderAmount || null,
            totalUsageLimit: totalUsageLimit || null,
            perUserLimit: perUserLimit || 1,
            validFrom: validFrom ? new Date(validFrom) : new Date(),
            validTill: validTill ? new Date(validTill) : null,
            isActive: isActive !== false
        }
    });

    res.success("Coupon created successfully", { coupon });
});

// Admin: Get all coupons
export const getAllCoupons = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
        prisma.coupon.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { usages: true } }
            }
        }),
        prisma.coupon.count()
    ]);

    res.success("Coupons fetched successfully", {
        coupons,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Admin: Get single coupon with stats
export const getCouponById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id || "", 10);

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid coupon ID");
    }

    const coupon = await getCouponStats(id);

    if (!coupon) {
        throw new ApiError(404, "Coupon not found");
    }

    res.success("Coupon fetched successfully", { coupon });
});

// Admin: Update coupon
export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id || "", 10);

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid coupon ID");
    }

    const existingCoupon = await prisma.coupon.findUnique({ where: { id } });

    if (!existingCoupon) {
        throw new ApiError(404, "Coupon not found");
    }

    const {
        discountType,
        discountValue,
        maxDiscountAmount,
        minOrderAmount,
        totalUsageLimit,
        perUserLimit,
        validFrom,
        validTill,
        isActive
    } = req.body;

    // Cannot change code after creation
    if (req.body.code && req.body.code.toUpperCase() !== existingCoupon.code) {
        throw new ApiError(400, "Cannot change coupon code after creation");
    }

    const updateData: Record<string, unknown> = {};

    if (discountType !== undefined) {
        if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
            throw new ApiError(400, "discountType must be PERCENTAGE or FIXED");
        }
        updateData.discountType = discountType;
    }

    if (discountValue !== undefined) {
        if (discountValue <= 0) {
            throw new ApiError(400, "discountValue must be greater than 0");
        }
        updateData.discountValue = discountValue;
    }

    if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount;
    if (totalUsageLimit !== undefined) updateData.totalUsageLimit = totalUsageLimit;
    if (perUserLimit !== undefined) updateData.perUserLimit = perUserLimit;
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
    if (validTill !== undefined) updateData.validTill = validTill ? new Date(validTill) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const coupon = await prisma.coupon.update({
        where: { id },
        data: updateData
    });

    res.success("Coupon updated successfully", { coupon });
});

// Admin: Delete coupon (soft delete)
export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id || "", 10);

    if (isNaN(id)) {
        throw new ApiError(400, "Invalid coupon ID");
    }

    const existingCoupon = await prisma.coupon.findUnique({ where: { id } });

    if (!existingCoupon) {
        throw new ApiError(404, "Coupon not found");
    }

    // Soft delete by setting isActive to false
    await prisma.coupon.update({
        where: { id },
        data: { isActive: false }
    });

    res.success("Coupon deleted successfully");
});

// User: Validate coupon for checkout
export const validateCouponCode = asyncHandler(async (req: Request, res: Response) => {
    const { couponCode, courseId, orderAmount } = req.body;
    const userId = req.user.id;

    if (!couponCode) {
        throw new ApiError(400, "Coupon code is required");
    }

    if (!courseId || !orderAmount) {
        throw new ApiError(400, "courseId and orderAmount are required");
    }

    const result = await validateCoupon(
        couponCode,
        userId,
        parseInt(courseId),
        parseFloat(orderAmount)
    );

    if (result.valid) {
        res.success(result.message || "Coupon validated", {
            valid: true,
            couponCode: result.couponCode,
            discountType: result.discountType,
            discountValue: result.discountValue,
            discountAmount: result.discountAmount,
            finalAmount: result.finalAmount
        });
    } else {
        // Return 200 with valid: false for client to handle gracefully
        res.success(result.message || "Invalid coupon", {
            valid: false,
            reason: result.reason
        });
    }
});
