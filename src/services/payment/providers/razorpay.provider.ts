import Razorpay from "razorpay";
import crypto from "crypto";
import { PaymentProvider } from "@prisma/client";
import { logger } from "../../../config/logger.config";
import { InternalError, ValidationError } from "../../../utils/api_error.utils";
import {
    IPaymentProvider,
    CreateOrderParams,
    CreateOrderResult,
    VerifyPaymentParams,
    VerifyPaymentResult
} from "../payment.types";

/**
 * ============================================================================
 * RAZORPAY PAYMENT PROVIDER
 * ============================================================================
 * 
 * This file handles ALL Razorpay-specific logic.
 * It implements the IPaymentProvider interface, so it works exactly like
 * any other payment gateway.
 * 
 * How it works:
 * 1. Get Razorpay credentials from environment
 * 2. Create orders using Razorpay SDK
 * 3. Verify payments using crypto signatures
 */

/**
 * STEP 1: Get Razorpay credentials
 * These come from environment variables (.env file)
 */
function getRazorpayConfig() {
    const keyId = process.env.RAZORPAY_KEY;
    const keySecret = process.env.RAZORPAY_SECRET;

    // Validate credentials are present
    if (!keyId || keyId.trim() === '') {
        logger.error('[Razorpay] RAZORPAY_KEY is missing or empty in environment variables');
        logger.error('[Razorpay] Please add RAZORPAY_KEY=rzp_test_xxxxx to your .env file');
        throw new InternalError('Razorpay API Key not configured');
    }

    if (!keySecret || keySecret.trim() === '') {
        logger.error('[Razorpay] RAZORPAY_SECRET is missing or empty in environment variables');
        logger.error('[Razorpay] Please add RAZORPAY_SECRET=xxxxx to your .env file');
        throw new InternalError('Razorpay Secret Key not configured');
    }

    // Log masked credentials to confirm they are loaded (security best practice)
    const maskedKeyId = keyId.substring(0, 12) + '...';
    const maskedSecret = keySecret.substring(0, 8) + '...';
    logger.info(`[Razorpay] Credentials loaded - Key: ${maskedKeyId}, Secret: ${maskedSecret}`);

    return { keyId, keySecret };
}

/**
 * STEP 2: Create a Razorpay client instance
 * This is the SDK object we use to talk to Razorpay
 */
function createRazorpayClient() {
    const { keyId, keySecret } = getRazorpayConfig();

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });
}


class RazorpayProvider implements IPaymentProvider {

    /**
     * Method 1: Create an order
     * 
     * This tells Razorpay we want to charge this customer.
     * Razorpay returns an order ID that we use on the frontend.
     */
    async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
        // VALIDATION: Check inputs before calling Razorpay
        if (!params.amount || params.amount <= 0) {
            logger.error('[Razorpay] Invalid amount provided:', params.amount);
            throw new ValidationError('Amount must be greater than zero');
        }

        if (!params.currency || params.currency.trim().length === 0) {
            logger.error('[Razorpay] Missing currency');
            throw new ValidationError('Currency is required');
        }

        if (!params.orderId) {
            logger.error('[Razorpay] Missing internal order ID');
            throw new ValidationError('Internal order ID is required');
        }

        const client = createRazorpayClient();
        const { keyId } = getRazorpayConfig();

        // Razorpay wants amount in PAISE (1 rupee = 100 paise)
        const amountInPaise = Math.round(params.amount * 100);

        logger.info('[Razorpay] Creating order with validated params:', {
            amount: params.amount,
            amountInPaise: amountInPaise,
            currency: params.currency,
            orderId: params.orderId,
            courseId: params.courseId
        });

        try {
            // Call Razorpay API to create order
            const razorpayOrder = await client.orders.create({
                amount: amountInPaise,
                currency: params.currency,
                receipt: `order_${params.orderId}`, // Our internal reference
                notes: {
                    // Extra info we want to track
                    internal_order_id: String(params.orderId),
                    course_id: String(params.courseId),
                    course_title: params.courseTitle,
                    user_email: params.userEmail
                }
            });

            // VALIDATION: Check Razorpay response is valid
            if (!razorpayOrder) {
                logger.error('[Razorpay] Received null/undefined response from SDK');
                throw new InternalError('Razorpay returned invalid response');
            }

            if (!razorpayOrder.id || razorpayOrder.id.length === 0) {
                logger.error('[Razorpay] Missing order ID in response:', razorpayOrder);
                throw new InternalError('Razorpay did not return order ID');
            }

            if (!razorpayOrder.amount) {
                logger.warn('[Razorpay] Missing amount in response');
            }

            logger.info('[Razorpay] Order created successfully:', {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                status: razorpayOrder.status
            });

            // Return the data in our standard format
            return {
                gatewayOrderId: razorpayOrder.id,
                amount: Number(razorpayOrder.amount),
                currency: razorpayOrder.currency,
                gatewayKeyId: keyId,
                provider: PaymentProvider.RAZORPAY
            };

        } catch (error: any) {
            // IMPROVED ERROR LOGGING
            // Razorpay errors have: description, code, statusCode (not just message)
            logger.error('[Razorpay] Order creation failed - Full error details:', {
                description: error.description || 'No description',
                message: error.message || 'No message',
                code: error.code || 'No code',
                statusCode: error.statusCode || 'No status code',
                field: error.field || 'No field',
                reason: error.reason || 'No reason',
                stack: error.stack
            });

            // Use description field (more informative than message)
            const errorMessage = error.description || error.message || 'Unknown Razorpay error occurred';
            throw new InternalError(`Razorpay order creation failed: ${errorMessage}`);
        }
    }

    /**
     * Method 2: Verify payment
     * 
     * After payment, Razorpay sends us a signature.
     * We need to verify this signature to make sure:
     * - The payment is real (not fake)
     * - Nobody tampered with the payment details
     * 
     * How signature verification works:
     * 1. Combine order_id + payment_id
     * 2. Create a hash using our secret key
     * 3. Compare with the signature Razorpay sent
     * 4. If they match = payment is valid!
     */
    async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
        const { keySecret } = getRazorpayConfig();

        // STEP 1: Create the expected signature
        const body = `${params.gatewayOrderId}|${params.gatewayPaymentId}`;
        const expectedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(body)
            .digest("hex");

        // STEP 2: Compare with what Razorpay sent
        const isValid = expectedSignature === params.gatewaySignature;

        if (isValid) {
            logger.info(`[Razorpay] Payment verified: ${params.gatewayPaymentId}`);
        } else {
            logger.warn(`[Razorpay] Invalid signature for payment: ${params.gatewayPaymentId}`);
        }

        return {
            isValid,
            paymentId: params.gatewayPaymentId,
            signature: params.gatewaySignature
        };
    }

    /**
     * Method 3: Get provider name
     * Simple - just returns "RAZORPAY"
     */
    getProviderName(): PaymentProvider {
        return PaymentProvider.RAZORPAY;
    }
}

/**
 * Export a single instance of the Razorpay provider
 * We use the same instance everywhere (singleton pattern)
 */
export const razorpayProvider = new RazorpayProvider();
