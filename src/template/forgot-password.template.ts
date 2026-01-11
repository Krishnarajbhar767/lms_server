import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface ForgotPasswordTemplateParams {
    firstName: string;
    forgotPasswordLink: string;
}

/**
 * Forgot Password Email Template
 * Sent when a user requests to reset their password
 */
export const forgotPasswordTemplate = (
    params: ForgotPasswordTemplateParams
): string => {
    const { firstName, forgotPasswordLink } = params;

    const content = `
        <div class="email-header">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">🔒</div>
            <h1 class="email-header-title">Reset Your Password</h1>
            <p class="email-header-subtitle">Let's get you back in</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Hi ${firstName},</p>
            
            <p class="message">
                We received a request to reset your password for your ${COMPANY.name} account.
                No worries, it happens to the best of us!
            </p>

            <!-- Reset Card -->
            <div class="info-card" style="text-align: center; padding: 32px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔑</div>
                <p style="color: ${EMAIL_THEME.textMuted}; font-size: 14px; margin-bottom: 24px;">
                    Click the button below to create a new password
                </p>
                <a href="${forgotPasswordLink}" class="cta-button">
                    Reset Password
                </a>
            </div>

            <!-- Warning -->
            <div class="warning-box">
                ⏱️ This password reset link will expire in <strong>15 minutes</strong>.
                For security reasons, please do not share this link with anyone.
            </div>

            <!-- Alternative Link -->
            <div class="link-text">
                <strong style="color: ${EMAIL_THEME.textSecondary};">Button not working?</strong>
                <br><br>
                Copy and paste this link in your browser:
                <br>
                <a href="${forgotPasswordLink}">${forgotPasswordLink}</a>
            </div>

            <hr class="divider">

            <!-- Security Tips -->
            <div class="info-card">
                <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 16px 0;">
                    🛡️ Security Tips
                </p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td width="24" valign="top" style="padding-bottom: 10px; color: ${EMAIL_THEME.accent};">•</td>
                        <td valign="top" style="padding-bottom: 10px; color: ${EMAIL_THEME.textMuted}; font-size: 13px;">
                            Use a strong, unique password
                        </td>
                    </tr>
                    <tr>
                        <td width="24" valign="top" style="padding-bottom: 10px; color: ${EMAIL_THEME.accent};">•</td>
                        <td valign="top" style="padding-bottom: 10px; color: ${EMAIL_THEME.textMuted}; font-size: 13px;">
                            Don't reuse passwords across sites
                        </td>
                    </tr>
                    <tr>
                        <td width="24" valign="top" style="color: ${EMAIL_THEME.accent};">•</td>
                        <td valign="top" style="color: ${EMAIL_THEME.textMuted}; font-size: 13px;">
                            Consider using a password manager
                        </td>
                    </tr>
                </table>
            </div>

            <hr class="divider">

            <!-- Didn't Request -->
            <div style="text-align: center;">
                <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 8px 0;">
                    Didn't request this?
                </p>
                <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; margin: 0;">
                    If you didn't request a password reset, you can safely ignore this email.
                    Your password will remain unchanged.
                </p>
            </div>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Reset Your Password - ' + COMPANY.name, content);
};
