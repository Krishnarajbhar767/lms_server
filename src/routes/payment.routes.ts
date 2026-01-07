import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";

// Import Controllers and Schemas
import { initiateBuyNow, cancelOrder, verifyPayment, getPaymentSettings, updatePaymentSettings, initiateCheckout, verifyCheckout } from "../controller/payment.controller";
import { initiatePaymentSchema, verifyPaymentSchema, updatePaymentSettingsSchema } from "../validation/payment.validation";

export const paymentRouter = Router();
/**
 * Route: POST /api/payment/buy-now
 * Desc: Initiates a transaction. Returns order details for Razorpay SDK.
 * Auth: Student/Admin (Authenticated)
 */
paymentRouter.post(
    "/buy-now",
    isAuthenticated,
    validate(initiatePaymentSchema),
    initiateBuyNow
);

/**
 * Route: POST /api/payment/checkout
 * Desc: Checkout entire cart. Creates orders for all cart items.
 * Auth: Authenticated
 */
paymentRouter.post(
    "/checkout",
    isAuthenticated,
    initiateCheckout
);

/**
 * Route: POST /api/payment/verify
 * Desc: Verifies the payment signature returned by Razorpay.
 * Auth: Student/Admin (Authenticated)
 */
paymentRouter.post(
    "/verify",
    isAuthenticated,
    validate(verifyPaymentSchema),
    verifyPayment
);

/**
 * Route: POST /api/payment/verify-checkout
 * Desc: Verifies cart checkout payment and enrolls in all courses.
 * Auth: Authenticated
 */
paymentRouter.post(
    "/verify-checkout",
    isAuthenticated,
    validate(verifyPaymentSchema),
    verifyCheckout
);

/**
 * Route: POST /api/payment/cancel-order
 * Desc: Cancel pending order (user closed modal)
 * Auth: Authenticated
 */
paymentRouter.post(
    "/cancel-order",
    isAuthenticated,
    cancelOrder
);

/**
 * Route: GET /api/payment/settings
 * Desc: Gets the currently active payment gateway.
 * Auth: Admin Only (for display in admin panel)
 */
paymentRouter.get(
    "/settings",
    isAuthenticated,
    isAdmin,
    getPaymentSettings
);

/**
 * Route: PUT /api/payment/settings
 * Desc: Updates the active payment gateway provider.
 * Auth: Admin Only
 */
paymentRouter.put(
    "/settings",
    isAuthenticated,
    isAdmin,
    validate(updatePaymentSettingsSchema),
    updatePaymentSettings
);
