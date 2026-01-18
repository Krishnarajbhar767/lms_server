import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface CartPurchaseItem {
    courseName: string;
    courseId: number;
    amount: number;
    originalPrice?: number;
}

interface CartPaymentSuccessParams {
    firstName: string;
    items: CartPurchaseItem[];
    totalAmount: number;
    currency?: string;
    orderId: string;
    paymentId: string;
    purchaseDate: Date;
}

/**
 * Cart Payment Success Email Template
 * Sent when a user successfully purchases multiple courses via cart checkout
 */
export const cartPaymentSuccessTemplate = (params: CartPaymentSuccessParams): string => {
    const {
        firstName,
        items,
        totalAmount,
        currency = 'INR',
        orderId,
        paymentId,
        purchaseDate,
    } = params;

    const formattedTotal = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
    }).format(totalAmount);

    const formattedDate = purchaseDate.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const dashboardUrl = `${COMPANY.website}/student/enrolled-courses`;

    // Generate course rows
    const courseRows = items.map((item, index) => {
        const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency }).format(item.amount);
        const formattedOriginal = item.originalPrice ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency }).format(item.originalPrice) : null;
        
        return `
        <tr>
            <td style="padding: 16px; border-bottom: 1px solid ${EMAIL_THEME.border};">
                <span style="color: ${EMAIL_THEME.textMuted}; font-size: 13px;">${index + 1}</span>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid ${EMAIL_THEME.border};">
                <a href="${COMPANY.website}/student/course/${item.courseId}/learn" 
                   style="color: ${EMAIL_THEME.accent}; text-decoration: none; font-weight: 500;">
                    ${item.courseName}
                </a>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid ${EMAIL_THEME.border}; text-align: right;">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="color: ${EMAIL_THEME.textPrimary}; font-weight: 600;">
                        ${formattedAmount}
                    </span>
                    ${(item.originalPrice && item.originalPrice > item.amount) ? `
                    <span style="color: ${EMAIL_THEME.textMuted}; font-size: 11px; text-decoration: line-through;">
                        ${formattedOriginal}
                    </span>
                    ` : ''}
                </div>
            </td>
        </tr>
    `}).join('');

    const content = `
        <div class="email-header">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🛒</div>
            <h1 class="email-header-title">Order Confirmed!</h1>
            <p class="email-header-subtitle">${items.length} course${items.length > 1 ? 's' : ''} purchased</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Hi ${firstName},</p>
            
            <p class="message">
                Your order has been confirmed! You're now enrolled in ${items.length} new course${items.length > 1 ? 's' : ''}.
                Get ready to expand your knowledge and skills!
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <span class="success-badge">
                    ✓ Payment Confirmed
                </span>
            </div>

            <!-- Courses Purchased Table -->
            <div class="info-card" style="padding: 0; overflow: hidden;">
                <div style="padding: 16px 20px; border-bottom: 1px solid ${EMAIL_THEME.border};">
                    <span style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary};">
                        📚 Courses Purchased
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: ${EMAIL_THEME.bodyBg};">
                            <th style="padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${EMAIL_THEME.textMuted}; letter-spacing: 0.5px; width: 40px;">#</th>
                            <th style="padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${EMAIL_THEME.textMuted}; letter-spacing: 0.5px;">Course</th>
                            <th style="padding: 12px 16px; text-align: right; font-size: 11px; text-transform: uppercase; color: ${EMAIL_THEME.textMuted}; letter-spacing: 0.5px;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courseRows}
                    </tbody>
                    <tfoot>
                        <tr style="background: ${EMAIL_THEME.cardBg};">
                            <td colspan="2" style="padding: 16px; text-align: right; font-weight: 600; color: ${EMAIL_THEME.textMuted};">
                                Total Paid
                            </td>
                            <td style="padding: 16px; text-align: right; font-weight: 700; font-size: 18px; color: ${EMAIL_THEME.accent};">
                                ${formattedTotal}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Order Details -->
            <div class="info-card" style="margin-top: 20px;">
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
                <a href="${dashboardUrl}" class="cta-button">
                    Go to My Courses →
                </a>
            </div>

            <hr class="divider">

            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; text-align: center;">
                Need help? Contact us at 
                <a href="mailto:${COMPANY.email}" style="color: ${EMAIL_THEME.accent}; text-decoration: none;">${COMPANY.email}</a>
            </p>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Order Confirmed - ' + COMPANY.name, content);
};
