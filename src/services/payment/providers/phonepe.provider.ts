import { PaymentProvider } from "@prisma/client";
import { NotImplementedError } from "../../../utils/api_error.utils";
import {
    IPaymentProvider,
    CreateOrderParams,
    CreateOrderResult,
    VerifyPaymentParams,
    VerifyPaymentResult
} from "../payment.types";

/**
 * ============================================================================
 * PHONEPE PAYMENT PROVIDER (PLACEHOLDER)
 * ============================================================================
 * 
 * This is a PLACEHOLDER implementation.
 * When admin selects PhonePe, this code runs and shows a clear error message.
 * 
 * To implement PhonePe later:
 * 1. Get PhonePe SDK/API documentation
 * 2. Add credentials to .env
 * 3. Replace the throw statements with actual PhonePe logic
 * 4. Follow the same pattern as Razorpay provider
 */
class PhonePeProvider implements IPaymentProvider {

    async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
        throw new NotImplementedError(
            "PhonePe payment gateway is not implemented yet. " +
            "Please select Razorpay in admin settings or contact support."
        );
    }

    async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
        throw new NotImplementedError(
            "PhonePe payment verification is not implemented yet. " +
            "Please select Razorpay in admin settings or contact support."
        );
    }

    getProviderName(): PaymentProvider {
        return PaymentProvider.PHONEPE;
    }
}

export const phonepeProvider = new PhonePeProvider();
