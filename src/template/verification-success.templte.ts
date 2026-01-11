import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

/**
 * Account Verification Success Email Template
 * Sent when a user successfully verifies their email
 */
export const accountVerificationSuccessTemplate = (firstName: string): string => {
    const loginUrl = `${COMPANY.website}/login`;
    const coursesUrl = `${COMPANY.website}`;

    const content = `
        <div class="email-header">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🎊</div>
            <h1 class="email-header-title">You're All Set!</h1>
            <p class="email-header-subtitle">Account verified successfully</p>
        </div>
        
        <div class="email-content">
            <div style="text-align: center; margin-bottom: 32px;">
                <span class="success-badge">
                    ✓ Email Verified
                </span>
            </div>

            <p class="greeting">Congratulations, ${firstName}! 🎉</p>
            
            <p class="message">
                Your email has been verified and your account is now fully activated.
                You're ready to explore our courses and start your learning journey!
            </p>

            <!-- What You Can Do Now -->
            <div class="info-card">
                <p style="font-size: 16px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 20px 0;">
                    ✨ What You Can Do Now
                </p>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td width="36" valign="top" style="padding-bottom: 16px;">
                            <span style="font-size: 20px;">📚</span>
                        </td>
                        <td valign="top" style="padding-bottom: 16px; padding-left: 8px;">
                            <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 4px 0;">
                                Browse Courses
                            </p>
                            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; margin: 0;">
                                Explore our wide range of courses
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td width="36" valign="top" style="padding-bottom: 16px;">
                            <span style="font-size: 20px;">🛒</span>
                        </td>
                        <td valign="top" style="padding-bottom: 16px; padding-left: 8px;">
                            <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 4px 0;">
                                Add to Cart
                            </p>
                            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; margin: 0;">
                                Save courses for later purchase
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td width="36" valign="top">
                            <span style="font-size: 20px;">🎓</span>
                        </td>
                        <td valign="top" style="padding-left: 8px;">
                            <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 4px 0;">
                                Start Learning
                            </p>
                            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; margin: 0;">
                                Enroll and learn at your own pace
                            </p>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" class="cta-button" style="margin-right: 12px;">
                    Login Now
                </a>
                <a href="${coursesUrl}" class="secondary-button">
                    Browse Courses
                </a>
            </div>

            <hr class="divider">

            <!-- Help Section -->
            <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; text-align: center;">
                Need help getting started? Check out our 
                <a href="${COMPANY.website}" style="color: ${EMAIL_THEME.accent}; text-decoration: none;">
                    getting started guide
                </a>
                or contact us at 
                <a href="mailto:${COMPANY.email}" style="color: ${EMAIL_THEME.accent}; text-decoration: none;">
                    ${COMPANY.email}
                </a>
            </p>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Welcome to ' + COMPANY.name, content);
};
