import { prisma } from "../../prisma";
import { logger } from "../../config/logger.config";
import { ValidationError, NotFoundError, InternalError } from "../../utils/api_error.utils.";
import { PaymentProvider } from "@prisma/client";
import { getPaymentProvider, getActiveProviderName, getPaymentProviderByName } from "./payment.factory";

/**
 * 
 * This is the CENTRAL place for all payment logic.
 * It uses the payment factory to automatically select the right gateway.
 * 
 * Flow:
 * 1. Controller calls this service
 * 2. Service gets active gateway from factory
 * 3. Gateway does the actual work
 * 4. Service handles database operations
 */

/**
 * Step 1: Initiate a "Buy Now" Order
 * 
 * What happens:
 * 1. Validate course exists and is published
 * 2. Check user not already enrolled
 * 3. Create PENDING order in database
 * 4. Ask payment gateway to create order
 * 5. Update order with gateway's order ID
 * 6. Return order details for frontend
 */
export const initiateBuyNowOrder = async (
    userId: number,
    courseId: number,
    userDetails: { name: string; email: string }
) => {
    logger.info(`[PaymentService] Starting BuyNow - User:${userId} Course:${courseId}`);

    // STEP 1: Validate Course
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, price: true, status: true }
    });

    if (!course) {
        throw new NotFoundError("Course not found.");
    }

    if (course.status !== "PUBLISHED") {
        throw new ValidationError("This course is not available for purchase.");
    }

    // EDGE CASE: Check for free courses
    // Payment gateways cannot process zero amount transactions
    if (course.price === 0) {
        logger.error('[PaymentService] Attempted to create payment for free course');
        throw new ValidationError("This is a free course. Please enroll directly without payment.");
    }

    // STEP 2: Check Existing Enrollment
    const existingEnrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } }
    });

    if (existingEnrollment) {
        throw new ValidationError("You are already enrolled in this course.");
    }

    // STEP 2A: Smart Pending Order Check with 1-min timeout
    const TIMEOUT_MINUTES = 1;

    const pendingOrder = await prisma.order.findFirst({
        where: { userId, courseId, status: "PENDING" },
        orderBy: { createdAt: 'desc' }
    });

    if (pendingOrder) {
        const ageMs = Date.now() - pendingOrder.createdAt.getTime();
        const timeoutMs = TIMEOUT_MINUTES * 60 * 1000;

        if (ageMs < timeoutMs) {
            // Order still fresh - user should wait
            const secondsAgo = Math.floor(ageMs / 1000);
            const minutesLeft = Math.ceil((timeoutMs - ageMs) / 60000);
            logger.warn(`[PaymentService] Recent pending order for User:${userId} Course:${courseId}`);
            throw new ValidationError(
                `Payment started ${secondsAgo}s ago. Wait ${minutesLeft} min to retry or complete current payment.`
            );
        }
        // Else: Order expired, allow new order (old one auto-ignored)
        logger.info(`[PaymentService] Ignoring expired pending order ${pendingOrder.id}`);
    }

    // STEP 3: Get Active Payment Gateway
    const paymentGateway = await getPaymentProvider();
    const providerName = paymentGateway.getProviderName();

    logger.info(`[PaymentService] Using gateway: ${providerName}`);

    // STEP 4: Create Local Order (PENDING)
    const order = await prisma.order.create({
        data: {
            userId,
            courseId,
            amount: course.price,
            currency: "INR",
            status: "PENDING",
            provider: providerName
        }
    });

    // STEP 5: Create Gateway Order
    try {
        const gatewayResult = await paymentGateway.createOrder({
            amount: course.price,
            currency: "INR",
            orderId: order.id,
            courseId: course.id,
            courseTitle: course.title,
            userEmail: userDetails.email,
            userName: userDetails.name
        });

        // STEP 6: Update Local Order with Gateway ID
        await prisma.order.update({
            where: { id: order.id },
            data: { gatewayOrderId: gatewayResult.gatewayOrderId }
        });

        // STEP 7: Return Combined Data (including provider info for frontend)
        return {
            success: true,
            data: {
                gatewayOrderId: gatewayResult.gatewayOrderId,
                amount: gatewayResult.amount,
                currency: gatewayResult.currency,
                key: gatewayResult.gatewayKeyId,
                provider: providerName, // Tell frontend which gateway to use!
                internalOrderId: order.id,
                courseTitle: course.title,
                userEmail: userDetails.email,
                userName: userDetails.name
            }
        };
    } catch (error: any) {
        // If gateway fails, mark order as FAILED and provide detailed error
        logger.error('[PaymentService] Gateway order creation failed:', {
            errorMessage: error.message,
            userId,
            courseId,
            orderId: order.id
        });

        await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED" }
        });

        // Re-throw with context
        throw error;
    }
};

/**
 * Step 2: Verify Payment Signature
 * 
 * What happens:
 * 1. Find the order in database (determines which provider was used)
 * 2. Get that specific provider instance
 * 3. Ask provider to verify the payment
 * 4. If valid, complete order + enroll user + record payment
 * 5. If invalid, mark order as FAILED
 * 
 * IMPORTANT: This function accepts GENERIC payment data.
 * Each provider extracts what it needs from this data.
 */
export const verifyPaymentSignature = async (
    userId: number,
    paymentData: Record<string, any> // Generic object - each provider knows what it needs
) => {
    logger.info(`[PaymentService] Verifying payment - User:${userId}`);

    // STEP 1: Extract gateway order ID (providers use different field names)
    // Try common field names used by different gateways
    const gatewayOrderId =
        paymentData.razorpay_order_id ||  // Razorpay
        paymentData.transactionId ||       // PhonePe
        paymentData.orderId ||             // Cashfree
        paymentData.order_id;              // Generic fallback

    if (!gatewayOrderId) {
        throw new ValidationError("Order ID not found in payment data");
    }

    // STEP 2: Find the Order (this tells us which provider to use)
    const order = await prisma.order.findUnique({
        where: { gatewayOrderId },
        include: { course: true }
    });

    if (!order) {
        throw new NotFoundError("Order record not found.");
    }

    // Check if already processed (idempotency check)
    if (order.status === "COMPLETED") {
        logger.info(`[PaymentService] Order ${order.id} already completed - idempotent response`);
        return { success: true, message: "Payment already processed." };
    }

    // EDGE CASE: Order is FAILED - should not be verifiable
    if (order.status === "FAILED") {
        logger.warn(`[PaymentService] Attempted to verify FAILED order ${order.id}`);
        throw new ValidationError("This order has failed. Please create a new order.");
    }

    // STEP 3: Get the CORRECT Payment Gateway (from order's provider)
    // This ensures we use the same gateway that created the order
    const paymentGateway = await getPaymentProviderByName(order.provider);

    logger.info(`[PaymentService] Using ${order.provider} for verification`);

    // STEP 4: Verify Signature using provider-specific logic
    // Each provider's verifyPayment() knows how to extract its own fields
    const verifyResult = await paymentGateway.verifyPayment({
        gatewayOrderId: paymentData.razorpay_order_id || paymentData.orderId || gatewayOrderId,
        gatewayPaymentId: paymentData.razorpay_payment_id || paymentData.transactionId || paymentData.paymentId,
        gatewaySignature: paymentData.razorpay_signature || paymentData.signature || paymentData.checksum
    });

    // STEP 5: Handle Invalid Signature
    if (!verifyResult.isValid) {
        logger.error('[PaymentService] Invalid payment signature:', {
            orderId: order.id,
            userId,
            gatewayOrderId
        });

        await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED" }
        });

        throw new ValidationError("Invalid payment signature. Payment verification failed.");
    }

    logger.info(`[PaymentService] Payment signature verified successfully for order ${order.id}`);


    // STEP 6: Success - Complete Order & Enroll User
    try {
        await prisma.$transaction(async (tx) => {
            // A. Update Order Status
            await tx.order.update({
                where: { id: order.id },
                data: { status: "COMPLETED" }
            });

            // B. Create Enrollment
            const enrollment = await tx.enrollment.create({
                data: {
                    userId: order.userId,
                    courseId: order.courseId
                }
            });

            // C. Create Payment Record
            await tx.payment.create({
                data: {
                    userId: order.userId,
                    courseId: order.courseId,
                    amount: order.amount,
                    provider: order.provider,
                    status: "SUCCESS",
                    gatewayPaymentId: verifyResult.paymentId,
                    gatewaySignature: verifyResult.signature,
                    orderId: order.id,
                    enrollmentId: enrollment.id
                }
            });

            // D. Remove from Cart (if user had it in cart)
            // After buying, no need to keep it in cart!
            // First, get user's cart
            const userCart = await tx.cart.findUnique({
                where: { userId: order.userId }
            });

            // If cart exists, remove this course item
            if (userCart) {
                await tx.cartItem.deleteMany({
                    where: {
                        cartId: userCart.id,
                        courseId: order.courseId
                    }
                });
                logger.info(`[PaymentService] Removed course ${order.courseId} from cart for User:${userId}`);
            }
        });

        logger.info(`[PaymentService] Payment verified and enrollment created for User:${userId}`);
        return { success: true, message: "Payment verified & Course enrolled." };
    } catch (error: any) {
        // Handle race conditions (duplicate enrollment attempts)
        if (error.code === "P2002") {
            return { success: true, message: "Already enrolled." };
        }
        logger.error(`[PaymentService] Transaction failed: ${error.message}`);
        throw new InternalError("Payment processing failed during enrollment.");
    }
};

/**
 * Step 3: Update Active Gateway (Admin)
 * 
 * Simply updates the database setting.
 * Next payment will automatically use the new gateway!
 */
export const updatePaymentGatewaySettings = async (provider: PaymentProvider) => {
    logger.info(`[PaymentService] Admin changing gateway to: ${provider}`);

    await prisma.appSettings.upsert({
        where: { key: "ACTIVE_PAYMENT_GATEWAY" },
        update: { value: provider },
        create: { key: "ACTIVE_PAYMENT_GATEWAY", value: provider }
    });

    return { success: true, provider };
};

/**
 * Step 4: Get Current Active Gateway (For Display)
 * 
 * Returns which gateway is currently active.
 * Used by admin UI to show current selection.
 */
export const getActiveGateway = async () => {
    const provider = await getActiveProviderName();
    return { provider };
};

/**
 * Cart Checkout - Buy multiple courses at once
 * 
 * Flow:
 * 1. Get cart items
 * 2. Validate all courses (published, not enrolled)
 * 3. Create separate Order for each course
 * 4. Create ONE gateway order with total amount
 * 5. Return payment data for frontend
 */
export const initiateCartCheckout = async (
    userId: number,
    userDetails: { name: string; email: string }
) => {
    logger.info(`[PaymentService] Starting Cart Checkout - User:${userId}`);

    // STEP 1: Get cart items
    const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
            items: {
                include: {
                    course: {
                        select: { id: true, title: true, price: true, status: true }
                    }
                }
            }
        }
    });

    if (!cart || cart.items.length === 0) {
        throw new ValidationError("Your cart is empty.");
    }

    const courses = cart.items.map(item => item.course);

    // STEP 2: Validate all courses
    const courseIds = courses.map(c => c.id);

    // Check for unpublished courses
    const unpublished = courses.filter(c => c.status !== "PUBLISHED");
    if (unpublished.length > 0) {
        throw new ValidationError(`Some courses are no longer available: ${unpublished.map(c => c.title).join(", ")}`);
    }

    // Check for free courses (payment gateway can't process 0)
    const freeCourses = courses.filter(c => c.price === 0);
    if (freeCourses.length > 0) {
        throw new ValidationError(`Please remove free courses and enroll directly: ${freeCourses.map(c => c.title).join(", ")}`);
    }

    // Check for existing enrollments
    const existingEnrollments = await prisma.enrollment.findMany({
        where: { userId, courseId: { in: courseIds } },
        select: { courseId: true }
    });

    if (existingEnrollments.length > 0) {
        const enrolledIds = existingEnrollments.map(e => e.courseId);
        const enrolledTitles = courses.filter(c => enrolledIds.includes(c.id)).map(c => c.title);
        throw new ValidationError(`Already enrolled in: ${enrolledTitles.join(", ")}. Please remove from cart.`);
    }

    // STEP 3: Check for recent pending orders (any course in cart)
    const TIMEOUT_MINUTES = 1;
    const timeoutMs = TIMEOUT_MINUTES * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    const pendingOrders = await prisma.order.findFirst({
        where: {
            userId,
            courseId: { in: courseIds },
            status: "PENDING",
            createdAt: { gt: cutoffTime }
        }
    });

    if (pendingOrders) {
        const secondsAgo = Math.floor((Date.now() - pendingOrders.createdAt.getTime()) / 1000);
        throw new ValidationError(`Payment started ${secondsAgo}s ago. Wait 1 min to retry.`);
    }

    // STEP 4: Calculate total
    const totalAmount = courses.reduce((sum, c) => sum + c.price, 0);
    const courseTitles = courses.map(c => c.title).join(", ");

    // STEP 5: Get active payment gateway
    const paymentGateway = await getPaymentProvider();
    const providerName = paymentGateway.getProviderName();

    logger.info(`[PaymentService] Cart checkout using: ${providerName}, Total: ₹${totalAmount}`);

    // STEP 6: Create orders for each course (PENDING)
    const orders = await prisma.$transaction(
        courses.map(course =>
            prisma.order.create({
                data: {
                    userId,
                    courseId: course.id,
                    amount: course.price,
                    currency: "INR",
                    status: "PENDING",
                    provider: providerName
                }
            })
        )
    );

    // STEP 7: Create ONE gateway order with total amount
    // Use first order ID as reference
    try {
        const gatewayResult = await paymentGateway.createOrder({
            amount: totalAmount,
            currency: "INR",
            orderId: orders[0]!.id,  // Non-null: orders always has items (validated above)
            courseId: courses[0]!.id, // Non-null: courses always has items (validated above)
            courseTitle: `Cart: ${courses.length} courses`,
            userEmail: userDetails.email,
            userName: userDetails.name
        });

        // Update FIRST order with gateway order ID (unique constraint)
        await prisma.order.update({
            where: { id: orders[0]!.id }, // Non-null: orders always has items
            data: { gatewayOrderId: gatewayResult.gatewayOrderId }
        });

        return {
            success: true,
            data: {
                gatewayOrderId: gatewayResult.gatewayOrderId,
                amount: gatewayResult.amount,
                currency: gatewayResult.currency,
                key: gatewayResult.gatewayKeyId,
                provider: providerName,
                internalOrderIds: orders.map(o => o.id), // All order IDs for verification
                courseCount: courses.length,
                courseTitles: courseTitles,
                userEmail: userDetails.email,
                userName: userDetails.name
            }
        };
    } catch (error: any) {
        // If gateway fails, mark all orders as FAILED
        await prisma.order.updateMany({
            where: { id: { in: orders.map(o => o.id) } },
            data: { status: "FAILED" }
        });
        throw error;
    }
};

/**
 * Verify Cart Payment - Complete all orders from checkout
 */
export const verifyCartPayment = async (
    userId: number,
    paymentData: Record<string, any>
) => {
    logger.info(`[PaymentService] Verifying cart payment - User:${userId}`);

    // Extract gateway order ID and order IDs from frontend
    const gatewayOrderId =
        paymentData.razorpay_order_id ||
        paymentData.transactionId ||
        paymentData.orderId ||
        paymentData.order_id;

    const orderIds: number[] = paymentData.orderIds || [];

    if (!gatewayOrderId) {
        throw new ValidationError("Order ID not found in payment data");
    }

    // Find orders - first by gatewayOrderId, then by orderIds
    let orders = await prisma.order.findMany({
        where: { gatewayOrderId },
        include: { course: true }
    });

    // If only one order found (the first one with gatewayOrderId), find the rest by IDs
    if (orders.length === 1 && orderIds.length > 1) {
        orders = await prisma.order.findMany({
            where: {
                id: { in: orderIds },
                userId: userId,
                status: "PENDING"
            },
            include: { course: true }
        });
    }

    if (orders.length === 0) {
        throw new NotFoundError("Orders not found.");
    }

    // Check if already processed
    if (orders.every(o => o.status === "COMPLETED")) {
        return { success: true, message: "Payment already processed." };
    }

    // Get payment gateway for verification
    const paymentGateway = await getPaymentProviderByName(orders[0]!.provider); // Non-null: orders length checked above

    // Verify signature
    const verifyResult = await paymentGateway.verifyPayment({
        gatewayOrderId: paymentData.razorpay_order_id || paymentData.orderId || gatewayOrderId,
        gatewayPaymentId: paymentData.razorpay_payment_id || paymentData.transactionId,
        gatewaySignature: paymentData.razorpay_signature || paymentData.signature
    });

    if (!verifyResult.isValid) {
        await prisma.order.updateMany({
            where: { id: { in: orders.map(o => o.id) } },
            data: { status: "FAILED" }
        });
        throw new ValidationError("Invalid payment signature.");
    }

    // Complete all orders + enrollments in transaction
    try {
        await prisma.$transaction(async (tx) => {
            for (const order of orders) {
                // Update order status
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: "COMPLETED" }
                });

                // Create enrollment
                const enrollment = await tx.enrollment.create({
                    data: { userId: order.userId, courseId: order.courseId }
                });

                // Create payment record
                await tx.payment.create({
                    data: {
                        userId: order.userId,
                        courseId: order.courseId,
                        amount: order.amount,
                        provider: order.provider,
                        status: "SUCCESS",
                        gatewayPaymentId: verifyResult.paymentId,
                        gatewaySignature: verifyResult.signature,
                        orderId: order.id,
                        enrollmentId: enrollment.id
                    }
                });
            }

            // Clear cart after successful checkout
            const userCart = await tx.cart.findUnique({ where: { userId } });
            if (userCart) {
                await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
            }
        });

        logger.info(`[PaymentService] Cart checkout complete - ${orders.length} courses enrolled`);
        return { success: true, message: `Enrolled in ${orders.length} courses!` };
    } catch (error: any) {
        if (error.code === "P2002") {
            return { success: true, message: "Already enrolled." };
        }
        throw new InternalError("Payment processing failed.");
    }
};
