import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface AccountUnblockedTemplateParams {
    firstName: string;
}

/**
 * Account Unblocked Email Template
 * Sent when an admin restores a user's account access
 */
export const accountUnblockedTemplate = (
    params: AccountUnblockedTemplateParams
): string => {
    const { firstName } = params;

    const content = `
        <div class="email-header" style="background: linear-gradient(135deg, #0a1a14 0%, ${EMAIL_THEME.containerBg} 100%);">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🎉</div>
            <h1 class="email-header-title">Account Restored</h1>
            <p class="email-header-subtitle">Welcome back to ${COMPANY.name}</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Great news, ${firstName}! 👋</p>
            
            <p class="message">
                We are pleased to inform you that your ${COMPANY.name} account has been 
                restored. You now have full access to all platform features, including 
                your courses, learning progress, and account settings.
            </p>

            <!-- Status Card -->
            <div class="info-card" style="text-align: center; padding: 32px;">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: ${EMAIL_THEME.successBg};
                    border: 1px solid ${EMAIL_THEME.successBorder};
                    color: ${EMAIL_THEME.success};
                    padding: 12px 24px;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 700;
                ">
                    ✓ ACCOUNT ACTIVE
                </div>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${COMPANY.website}/login" class="cta-button" style="
                    display: inline-block;
                    background: ${EMAIL_THEME.accent};
                    color: #000814 !important;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 15px;
                ">
                    Continue Learning
                </a>
            </div>

            <hr class="divider">

            <!-- What's Available -->
            <div style="background: ${EMAIL_THEME.cardBg}; border-radius: 12px; padding: 24px;">
                <p style="font-size: 16px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 16px 0;">
                    What you can do now
                </p>
                <ul style="color: ${EMAIL_THEME.textSecondary}; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>Access all your enrolled courses</li>
                    <li>Continue your learning progress</li>
                    <li>Browse and enroll in new courses</li>
                    <li>View and download certificates</li>
                </ul>
            </div>

            <!-- Welcome Note -->
            <div style="background: ${EMAIL_THEME.successBg}; border-radius: 8px; padding: 20px; margin-top: 24px; border-left: 4px solid ${EMAIL_THEME.success};">
                <p style="font-size: 14px; color: ${EMAIL_THEME.textSecondary}; margin: 0;">
                    💡 <strong style="color: ${EMAIL_THEME.textPrimary};">Tip:</strong> 
                    Make sure to review our community guidelines to ensure a positive 
                    learning experience for everyone.
                </p>
            </div>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Account Restored - ' + COMPANY.name, content);
};
