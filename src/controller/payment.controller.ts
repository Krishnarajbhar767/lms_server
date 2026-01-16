import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import * as PaymentService from "../services/payment/payment.service";
import { sendMail } from "../utils/send_mail.utils";
import { paymentSuccessTemplate } from "../template/payment-success.template";
import { cartPaymentSuccessTemplate } from "../template/cart-payment-success.template";
import { logger } from "../config/logger.config";

/**
 * 1. Initiate Buy Now
 * Route: POST /api/payment/buy-now
 */
export const initiateBuyNow = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);
    const { courseId } = req.body;

    // We pass user details for the payment receipt
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true }
    });

    if (!user) {
        throw new Error("User not found");
    }

    const userDetails = {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
    };

    const result = await PaymentService.initiateBuyNowOrder(userId, courseId, userDetails);

    return res.status(200).json({
        success: true,
        message: "Payment Initiated",
        data: result.data
    });
});

/**
 * 2. Verify Payment
 * Route: POST /api/payment/verify
 * 
 * Accepts payment data from ANY gateway (Razorpay, PhonePe, Cashfree, etc.)
 * The service layer will route to the correct provider based on the order.
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    // Pass the ENTIRE request body - it contains provider-specific fields
    // Service layer will extract what it needs based on the original order's provider
    const result = await PaymentService.verifyPaymentSignature(userId, req.body);

    // Send Email in background (Fire and Forget)
    if (result.success) {
        // Fire and forget - don't await, don't block response
        (async () => {
            try {
                // Fetch order with course and user details for email
                const order = await prisma.order.findFirst({
                    where: {
                        gatewayOrderId: req.body.razorpay_order_id,
                    },
                    include: {
                        course: { select: { id: true, title: true } },
                        user: { select: { firstName: true, email: true } },
                        payment: { select: { gatewayPaymentId: true } },
                    },
                });

                if (order && order.user.email) {
                    const emailHtml = paymentSuccessTemplate({
                        firstName: order.user.firstName,
                        courseName: order.course.title,
                        courseId: order.course.id,
                        amount: order.amount,
                        currency: order.currency,
                        orderId: order.gatewayOrderId || `ORD-${order.id}`,
                        paymentId: order.payment?.gatewayPaymentId || req.body.razorpay_payment_id || 'N/A',
                        purchaseDate: order.createdAt,
                    });

                    await sendMail(
                        order.user.email,
                        `🎉 Payment Successful - ${order.course.title}`,
                        emailHtml
                    );
                    logger.info(`Payment success email sent to ${order.user.email}`);
                }
            } catch (e: any) {
                logger.error(`Failed to send payment success email: ${e.message}`);
            }
        })();
    }

    return res.status(200).json({
        success: true,
        message: result.message,
        verified: true
    });
});

/**
 * 2b. Cancel Order
 * Route: POST /api/payment/cancel-order
 * 
 * Allows user to cancel their PENDING order when modal closes
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);
    const { orderId } = req.body;

    // Security: Verify ownership and status
    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            userId: userId,
            status: "PENDING"
        }
    });

    if (!order) {
        // Already processed or doesn't exist
        return res.status(200).json({
            success: true,
            message: "Order already processed"
        });
    }

    // Mark as FAILED (allows immediate retry)
    await prisma.order.update({
        where: { id: orderId },
        data: { status: "FAILED" }
    });

    return res.status(200).json({
        success: true,
        message: "Order cancelled"
    });
});

/**
 * 3. Get Active Gateway (Admin/Display)
 * Route: GET /api/payment/settings
 */
export const getPaymentSettings = asyncHandler(async (req: Request, res: Response) => {
    const result = await PaymentService.getActiveGateway();

    return res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * 4. Update Settings (Admin)
 * Route: PUT /api/payment/settings
 */
export const updatePaymentSettings = asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.body;
    await PaymentService.updatePaymentGatewaySettings(provider);

    return res.status(200).json({
        success: true,
        message: `Active payment gateway updated to ${provider}`
    });
});

/**
 * 5. Initiate Cart Checkout
 * Route: POST /api/payment/checkout
 */
export const initiateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true }
    });

    if (!user) {
        throw new Error("User not found");
    }

    const userDetails = {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
    };

    // Optional coupon data from frontend (validated on frontend, will be re-validated)
    let couponData: { couponCode: string; discountAmount: number; finalAmount?: number } | undefined;
    if (req.body.couponCode) {
        couponData = {
            couponCode: String(req.body.couponCode),
            discountAmount: Number(req.body.discountAmount) || 0
        };
        if (req.body.finalAmount) {
            couponData.finalAmount = Number(req.body.finalAmount);
        }
    }

    const result = await PaymentService.initiateCartCheckout(userId, userDetails, couponData);

    return res.status(200).json({
        success: true,
        message: "Checkout Initiated",
        data: result.data
    });
});

/**
 * 6. Verify Cart Payment
 * Route: POST /api/payment/verify-checkout
 */
export const verifyCheckout = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    const result = await PaymentService.verifyCartPayment(userId, req.body);

    // Send Cart Checkout Email in background (Fire and Forget)
    if (result.success) {
        (async () => {
            try {
                // Fetch all orders from this checkout with course and user details
                const orders = await prisma.order.findMany({
                    where: {
                        userId,
                        gatewayOrderId: req.body.razorpay_order_id,
                        status: 'COMPLETED',
                    },
                    include: {
                        course: { select: { id: true, title: true } },
                        user: { select: { firstName: true, email: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                });

                const firstOrder = orders[0];
                if (orders.length > 0 && firstOrder && firstOrder.user.email) {
                    const items = orders.map(order => ({
                        courseName: order.course.title,
                        courseId: order.course.id,
                        amount: order.amount,
                    }));

                    const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);

                    const emailHtml = cartPaymentSuccessTemplate({
                        firstName: firstOrder.user.firstName,
                        items,
                        totalAmount,
                        currency: firstOrder.currency,
                        orderId: firstOrder.gatewayOrderId || `ORD-${firstOrder.id}`,
                        paymentId: req.body.razorpay_payment_id || 'N/A',
                        purchaseDate: firstOrder.createdAt,
                    });

                    await sendMail(
                        firstOrder.user.email,
                        `🛒 Order Confirmed - ${items.length} Course${items.length > 1 ? 's' : ''} Purchased`,
                        emailHtml
                    );
                    logger.info(`Cart payment success email sent to ${firstOrder.user.email}`);
                }
            } catch (e: any) {
                logger.error(`Failed to send cart payment success email: ${e.message}`);
            }
        })();
    }

    return res.status(200).json({
        success: true,
        message: result.message,
        verified: true
    });
});

/**
 * 7. Get Purchase History
 * Route: GET /api/payment/history
 * Returns all completed orders for the authenticated user
 */
export const getPurchaseHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    const orders = await prisma.order.findMany({
        where: {
            userId,
        },
        include: {
            course: {
                select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                }
            },
            payment: {
                select: {
                    gatewayPaymentId: true,
                    provider: true,
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return res.status(200).json({
        success: true,
        message: "Purchase history fetched",
        data: orders
    });
});

