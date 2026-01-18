import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface PaymentSuccessParams {
    firstName: string;
    courseName: string;
    courseId: number;
    amount: number;
    currency?: string;
    orderId: string;
    paymentId: string;
    purchaseDate: Date;
    originalPrice?: number;
    discountAmount?: number;
    couponCode?: string | undefined;
}

/**
 * Payment Success Email Template
 * Sent when a user successfully purchases a course
 */
export const paymentSuccessTemplate = (params: PaymentSuccessParams): string => {
    const {
        firstName,
        courseName,
        courseId,
        amount,
        currency = 'INR',
        orderId,
        paymentId,
        purchaseDate,
        originalPrice,
        discountAmount,
        couponCode
    } = params;

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
    }).format(val);

    // Calculate actual amount paid (after coupon) with safety check
    const actualPaid = Math.max(0, amount - (discountAmount || 0));
    const formattedActualPaid = formatCurrency(actualPaid);
    const formattedOriginalPrice = originalPrice ? formatCurrency(originalPrice) : null;
    const formattedDiscount = discountAmount && discountAmount > 0 ? formatCurrency(discountAmount) : null;

    const formattedDate = purchaseDate.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const courseUrl = `${COMPANY.website}/student/course/${courseId}/learn`;

    // Pricing Breakdown Logic
    let pricingRows = '';
    
    // 1. Original Price (if different from final amount)
    if (formattedOriginalPrice && originalPrice && originalPrice > amount) {
        pricingRows += `
            <div class="info-row">
                <span class="info-label">Original Price</span>
                <span class="info-value" style="text-decoration: line-through; color: ${EMAIL_THEME.textMuted};">${formattedOriginalPrice}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Sale Price</span>
                <span class="info-value">${formatCurrency(amount)}</span>
            </div>
        `;
    }

    // 2. Coupon Applied
    if (couponCode) {
        pricingRows += `
            <div class="info-row">
                <span class="info-label">Coupon Code</span>
                <span class="info-value" style="color: ${EMAIL_THEME.accent}; font-weight: bold;">${couponCode}</span>
            </div>
        `;
    }

    // 3. Discount Amount
    if (formattedDiscount) {
         pricingRows += `
            <div class="info-row">
                <span class="info-label">Coupon Discount</span>
                <span class="info-value" style="color: #10b981;">-${formattedDiscount}</span>
            </div>
        `;
    }

    const content = `
        <div class="email-header">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🎉</div>
            <h1 class="email-header-title">Payment Successful!</h1>
            <p class="email-header-subtitle">Your enrollment is confirmed</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Hi ${firstName},</p>
            
            <p class="message">
                Great news! Your payment was successful and you're now enrolled in your new course.
                We're excited to have you start your learning journey with us!
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <span class="success-badge">
                    ✓ Payment Confirmed
                </span>
            </div>

            <!-- Order Summary Card -->
            <div class="info-card">
                <div style="margin-bottom: 16px;">
                    <span style="font-size: 12px; color: ${EMAIL_THEME.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ORDER SUMMARY
                    </span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Course</span>
                    <span class="info-value" style="color: ${EMAIL_THEME.accent};">${courseName}</span>
                </div>

                ${pricingRows}
                
                <div class="info-row" style="border-top: 1px dashed ${EMAIL_THEME.border}; margin-top: 8px; padding-top: 8px;">
                    <span class="info-label" style="font-weight: 700; color: ${EMAIL_THEME.textPrimary};">Total Paid</span>
                    <span class="info-value" style="font-weight: 700; color: ${EMAIL_THEME.textPrimary}; font-size: 16px;">${formattedActualPaid}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Order ID</span>
                    <span class="info-value" style="font-size: 13px; font-family: monospace;">${orderId}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Payment ID</span>
                    <span class="info-value" style="font-size: 13px; font-family: monospace;">${paymentId}</span>
                </div>
                
                <div class="info-row" style="border-bottom: none;">
                    <span class="info-label">Purchase Date</span>
                    <span class="info-value">${formattedDate}</span>
                </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${courseUrl}" class="cta-button">
                    Start Learning Now →
                </a>
            </div>

            <hr class="divider">

            <!-- What's Next Section -->
            <div style="margin-top: 24px;">
                <p style="font-size: 16px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin-bottom: 20px;">
                    What's Next?
                </p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td width="36" valign="middle" style="padding-bottom: 16px;">
                            <div style="background: ${EMAIL_THEME.accent}; color: #000814; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">1</div>
                        </td>
                        <td valign="middle" style="padding-bottom: 16px; padding-left: 8px; color: ${EMAIL_THEME.textSecondary}; font-size: 14px;">
                            Access your course from your dashboard
                        </td>
                    </tr>
                    <tr>
                        <td width="36" valign="middle" style="padding-bottom: 16px;">
                            <div style="background: ${EMAIL_THEME.accent}; color: #000814; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">2</div>
                        </td>
                        <td valign="middle" style="padding-bottom: 16px; padding-left: 8px; color: ${EMAIL_THEME.textSecondary}; font-size: 14px;">
                            Watch video lessons at your own pace
                        </td>
                    </tr>
                    <tr>
                        <td width="36" valign="middle">
                            <div style="background: ${EMAIL_THEME.accent}; color: #000814; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">3</div>
                        </td>
                        <td valign="middle" style="padding-left: 8px; color: ${EMAIL_THEME.textSecondary}; font-size: 14px;">
                            Complete the course and earn your certificate
                        </td>
                    </tr>
                </table>
            </div>

            <hr class="divider">

            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; text-align: center;">
                Need help? Contact us at 
                <a href="mailto:${COMPANY.email}" style="color: ${EMAIL_THEME.accent}; text-decoration: none;">${COMPANY.email}</a>
            </p>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Payment Successful - ' + COMPANY.name, content);
};
