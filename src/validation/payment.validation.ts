import { z } from "zod";

// ============================================================================
// PAYMENT VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for initiating a "Buy Now" Purchase.
 * We only need the courseId because the userId comes from the authenticated session.
 */
export const initiatePaymentSchema = z.object({
    courseId: z.coerce
        .number({ error: "Course ID is required" })
        .int("Course ID must be an integer")
        .positive("Course ID must be a positive number"),
});

/**
 * Schema for verifying a Payment Transaction.
 * 
 * IMPORTANT: This schema is GENERIC - it works for ALL payment providers.
 * Different providers send different fields:
 * - Razorpay: razorpay_order_id, razorpay_payment_id, razorpay_signature
 * - PhonePe: transactionId, merchantTransactionId, etc.
 * - Cashfree: orderId, orderToken, etc.
 * 
 * We accept ANY additional fields and let the service layer route to correct provider.
 */
export const verifyPaymentSchema = z.object({
    // Allow any fields - each provider requires different data
    // The service will validate provider-specific requirements
}).loose();

/**
 * Schema for Admin Settings to change the Payment Provider.
 */
export const updatePaymentSettingsSchema = z.object({
    provider: z.enum(["RAZORPAY", "PHONEPE", "CASHFREE"], {
        error: "Invalid Payment Provider. Must be RAZORPAY, PHONEPE, or CASHFREE."
    })
});
