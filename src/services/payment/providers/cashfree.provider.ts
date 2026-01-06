import { PaymentProvider } from "@prisma/client";
import { NotImplementedError } from "../../../utils/api_error.utils.";
import {
    IPaymentProvider,
    CreateOrderParams,
    CreateOrderResult,
    VerifyPaymentParams,
    VerifyPaymentResult
} from "../payment.types";

/**
 * ============================================================================
 * CASHFREE PAYMENT PROVIDER (PLACEHOLDER)
 * ============================================================================
 * 
 * This is a PLACEHOLDER implementation.
 * When admin selects Cashfree, this code runs and shows a clear error message.
 * 
 * To implement Cashfree later:
 * 1. Get Cashfree SDK/API documentation
 * 2. Add credentials to .env
 * 3. Replace the throw statements with actual Cashfree logic
 * 4. Follow the same pattern as Razorpay provider
 */
class CashfreeProvider implements IPaymentProvider {

    async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
        throw new NotImplementedError(
            "Cashfree payment gateway is not implemented yet. " +
            "Please select Razorpay in admin settings or contact support."
        );
    }

    async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
        throw new NotImplementedError(
            "Cashfree payment verification is not implemented yet. " +
            "Please select Razorpay in admin settings or contact support."
        );
    }

    getProviderName(): PaymentProvider {
        return PaymentProvider.CASHFREE;
    }
}

export const cashfreeProvider = new CashfreeProvider();
