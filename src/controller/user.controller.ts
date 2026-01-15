import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { ApiError } from "../utils/api_error.utils";
import { prisma } from "../prisma";
import { invalidateAllSessions } from "../services/session.service";
import { invalidateBlockCache } from "../middleware/auth.middleware";
import { sendMail } from "../utils/send_mail.utils";
import { accountBlockedTemplate } from "../template/account-blocked.template";
import { accountUnblockedTemplate } from "../template/account-unblocked.template";

// get all users with pagination
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                isBlocked: true,
                blockedAt: true,
                blockedReason: true,
                createdAt: true,
                _count: { select: { enrollments: true } }
            }
        }),
        prisma.user.count()
    ]);

    res.success("Users fetched successfully", {
        users,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// block a user
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id || "", 10);
    const { reason } = req.body as { reason?: string };

    if (Number.isNaN(userId)) {
        throw new ApiError(400, "User ID is required");
    }

    // find user with email for notification
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isBlocked: true, firstName: true, email: true }
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // cannot block admin
    if (user.role === "ADMIN") {
        throw new ApiError(403, "Cannot block admin users");
    }

    // cannot block self
    if (user.id === req.user.id) {
        throw new ApiError(403, "Cannot block yourself");
    }

    // already blocked
    if (user.isBlocked) {
        throw new ApiError(400, "User is already blocked");
    }

    // block user
    await prisma.user.update({
        where: { id: userId },
        data: {
            isBlocked: true,
            blockedAt: new Date(),
            blockedReason: reason || null
        }
    });

    // invalidate block cache and all sessions to force logout
    await invalidateBlockCache(userId);
    await invalidateAllSessions(userId);

    // send block notification email
    const emailTemplate = accountBlockedTemplate({
        firstName: user.firstName,
        reason: reason || undefined
    });
    sendMail(user.email, "Account Suspended", emailTemplate).catch(() => {});

    res.success("User blocked successfully");
});

// unblock a user
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id || "", 10);

    if (Number.isNaN(userId)) {
        throw new ApiError(400, "User ID is required");
    }

    // find user with email for notification
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isBlocked: true, firstName: true, email: true }
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.isBlocked) {
        throw new ApiError(400, "User is not blocked");
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            isBlocked: false,
            blockedAt: null,
            blockedReason: null
        }
    });

    // invalidate block cache so user can access immediately
    await invalidateBlockCache(userId);

    // send unblock notification email
    const emailTemplate = accountUnblockedTemplate({
        firstName: user.firstName
    });
    sendMail(user.email, "Account Restored", emailTemplate).catch(() => {});

    res.success("User unblocked successfully");
});

