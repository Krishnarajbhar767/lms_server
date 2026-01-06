import { PaymentProvider } from "@prisma/client";

/**
 * ============================================================================
 * PAYMENT PROVIDER TYPES
 * 
 * This file defines the contract that ALL payment gateways must follow.
 * Think of it as a recipe - every gateway must have these exact ingredients.
 */

// ----------------------------------------------------------------------------
// INPUT TYPES (What we send TO the gateway)
// ----------------------------------------------------------------------------

/**
 * Information needed to create an order with ANY payment gateway
 */
export interface CreateOrderParams {
    amount: number;              // How much money (in INR)
    currency: string;            // Usually "INR"
    orderId: number;             // Our internal order ID
    courseId: number;            // Which course
    courseTitle: string;         // Course name for receipt
    userEmail: string;           // Customer email
    userName: string;            // Customer name
}

/**
 * Information needed to verify a payment was real
 */
export interface VerifyPaymentParams {
    gatewayOrderId: string;      // Order ID from the gateway
    gatewayPaymentId: string;    // Payment ID from the gateway
    gatewaySignature: string;    // Security signature from the gateway
}

// ----------------------------------------------------------------------------
// OUTPUT TYPES (What we get BACK from the gateway)
// ----------------------------------------------------------------------------

/**
 * What we get back after creating an order
 */
export interface CreateOrderResult {
    gatewayOrderId: string;      // The gateway's order ID
    amount: number;              // Amount in smallest unit (paise for Razorpay)
    currency: string;            // Currency code
    gatewayKeyId: string;        // Public key for frontend
    provider: PaymentProvider;   // Which gateway this is
}

/**
 * Result of payment verification
 */
export interface VerifyPaymentResult {
    isValid: boolean;            // Is the payment genuine?
    paymentId: string;           // Payment ID
    signature: string;           // The signature we verified
}

// ----------------------------------------------------------------------------
// THE MAIN INTERFACE (The Contract)
// ----------------------------------------------------------------------------

/**
 * Every payment gateway MUST implement these methods.
 * This ensures all gateways work the same way.
 * 
 * Example:
 * - Razorpay implements this interface
 * - PhonePe implements this interface  
 * - Cashfree implements this interface
 * 
 * So we can switch between them without changing other code!
 */
export interface IPaymentProvider {
    /**
     * Create a new order/transaction
     * @param params - Order details
     * @returns Order information for the frontend
     */
    createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;

    /**
     * Verify that a payment signature is real (not fake)
     * @param params - Payment verification data
     * @returns Whether the payment is valid
     */
    verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;

    /**
     * Get the name of this payment provider
     * @returns Provider name (e.g., "RAZORPAY")
     */
    getProviderName(): PaymentProvider;
}
