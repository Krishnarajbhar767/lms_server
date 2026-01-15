import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface AccountBlockedTemplateParams {
    firstName: string;
    reason?: string | undefined;
}

/**
 * Account Blocked Email Template
 * Sent when an admin blocks a user account
 */
export const accountBlockedTemplate = (
    params: AccountBlockedTemplateParams
): string => {
    const { firstName, reason } = params;

    const reasonSection = reason ? `
        <div class="info-card">
            <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Reason Provided</span>
            </div>
            <p style="color: ${EMAIL_THEME.textSecondary}; font-size: 14px; margin: 0; line-height: 1.6;">
                ${reason}
            </p>
        </div>
    ` : '';

    const content = `
        <div class="email-header" style="background: linear-gradient(135deg, #1a0a0f 0%, ${EMAIL_THEME.containerBg} 100%);">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🚫</div>
            <h1 class="email-header-title">Account Suspended</h1>
            <p class="email-header-subtitle">Your access has been restricted</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Hello, ${firstName}</p>
            
            <p class="message">
                We are writing to inform you that your ${COMPANY.name} account has been 
                temporarily suspended by our administration team. During this time, you 
                will not be able to access your courses, make purchases, or use any 
                platform features.
            </p>

            <!-- Status Card -->
            <div class="info-card" style="text-align: center; padding: 32px; border: 1px solid ${EMAIL_THEME.error}40;">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: ${EMAIL_THEME.error}20;
                    border: 1px solid ${EMAIL_THEME.error}40;
                    color: ${EMAIL_THEME.error};
                    padding: 12px 24px;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 700;
                ">
                    ⛔ ACCOUNT BLOCKED
                </div>
            </div>

            ${reasonSection}

            <hr class="divider">

            <!-- What You Can Do -->
            <div style="background: ${EMAIL_THEME.cardBg}; border-radius: 12px; padding: 24px;">
                <p style="font-size: 16px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 16px 0;">
                    What can you do?
                </p>
                <ul style="color: ${EMAIL_THEME.textSecondary}; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>Contact our support team if you believe this is an error</li>
                    <li>Reply to this email with any questions</li>
                </ul>
            </div>

            <!-- Contact Support -->
            <div style="text-align: center; margin-top: 32px;">
                <a href="mailto:${COMPANY.email}" class="secondary-button" style="
                    display: inline-block;
                    background: transparent;
                    color: ${EMAIL_THEME.accent} !important;
                    padding: 12px 24px;
                    border: 2px solid ${EMAIL_THEME.accent};
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 14px;
                ">
                    Contact Support
                </a>
            </div>

            <!-- Notice -->
            <div class="warning-box" style="margin-top: 32px; border-left-color: ${EMAIL_THEME.error}; color: ${EMAIL_THEME.textSecondary};">
                ⚠️ If you attempt to create a new account to bypass this restriction, 
                it may result in permanent suspension of all associated accounts.
            </div>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Account Suspended - ' + COMPANY.name, content);
};
