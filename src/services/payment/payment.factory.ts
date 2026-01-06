import { PaymentProvider } from "@prisma/client";
import { prisma } from "../../prisma";
import { logger } from "../../config/logger.config";
import { IPaymentProvider } from "./payment.types";

// Import all payment providers
import { razorpayProvider } from "./providers/razorpay.provider";
import { phonepeProvider } from "./providers/phonepe.provider";
import { cashfreeProvider } from "./providers/cashfree.provider";

/**
 * PAYMENT FACTORY
 * 
 * This is the "smart selector" that picks which payment gateway to use.
 * 
 * How it works:
 * 1. Check database for admin's selected gateway
 * 2. Return that gateway's implementation
 * 3. If nothing selected, default to Razorpay
 * 
 * This is called EVERY time we need to process a payment, so it always
 * uses the most current admin setting.
 */

/**
 * Get the active payment provider from database
 * 
 * Think of this like checking a settings file to see which
 * delivery company the admin wants to use today.
 */
async function getActiveProviderFromDB(): Promise<PaymentProvider> {
    try {
        // Look for the setting in database
        const setting = await prisma.appSettings.findUnique({
            where: { key: "ACTIVE_PAYMENT_GATEWAY" }
        });

        // If found, return that gateway
        if (setting && setting.value) {
            logger.info(`[PaymentFactory] Active gateway: ${setting.value}`);
            return setting.value as PaymentProvider;
        }

        // If not found, use Razorpay as default
        logger.info("[PaymentFactory] No gateway setting found, defaulting to RAZORPAY");
        return PaymentProvider.RAZORPAY;

    } catch (error: any) {
        // If database fails, still return Razorpay so payments don't break
        logger.error(`[PaymentFactory] Database error: ${error.message}, defaulting to RAZORPAY`);
        return PaymentProvider.RAZORPAY;
    }
}

/**
 * Get the payment provider instance
 * 
 * This is the main function everyone calls.
 * Returns the correct payment gateway object based on admin settings.
 * 
 * Example:
 * const gateway = await getPaymentProvider();
 * gateway.createOrder(...) // This calls the right gateway!
 */
export async function getPaymentProvider(): Promise<IPaymentProvider> {
    // STEP 1: Find out which gateway is active
    const activeProvider = await getActiveProviderFromDB();

    // STEP 2: Return the matching provider implementation
    switch (activeProvider) {
        case PaymentProvider.RAZORPAY:
            return razorpayProvider;

        case PaymentProvider.PHONEPE:
            return phonepeProvider;

        case PaymentProvider.CASHFREE:
            return cashfreeProvider;

        default:
            // This should never happen, but just in case...
            logger.warn(`[PaymentFactory] Unknown provider: ${activeProvider}, defaulting to RAZORPAY`);
            return razorpayProvider;
    }
}

/**
 * Helper: Get current active provider name (for display purposes)
 * 
 * Used by the frontend to show "Currently using: Razorpay"
 */
export async function getActiveProviderName(): Promise<PaymentProvider> {
    return await getActiveProviderFromDB();
}

/**
 * Get payment provider by specific name
 * 
 * Used during verification to get the SAME provider that created the order
 * (not the currently active one, which might have changed)
 */
export async function getPaymentProviderByName(providerName: PaymentProvider): Promise<IPaymentProvider> {
    logger.info(`[PaymentFactory] Getting specific provider: ${providerName}`);

    switch (providerName) {
        case PaymentProvider.RAZORPAY:
            return razorpayProvider;

        case PaymentProvider.PHONEPE:
            return phonepeProvider;

        case PaymentProvider.CASHFREE:
            return cashfreeProvider;

        default:
            logger.warn(`[PaymentFactory] Unknown provider: ${providerName}, falling back to RAZORPAY`);
            return razorpayProvider;
    }
}
