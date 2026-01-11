import { COMPANY } from '../COMPANY';
import { getEmailWrapper, getEmailFooter, EMAIL_THEME } from './email-theme';

interface AccountVerificationTemplateParams {
    firstName: string;
    verificationLink: string;
}

/**
 * Account Verification Email Template
 * Sent when a new user registers and needs to verify their email
 */
export const accountVerificationTemplate = (
    params: AccountVerificationTemplateParams
): string => {
    const { firstName, verificationLink } = params;

    const content = `
        <div class="email-header">
            <div class="email-logo">${COMPANY.name}</div>
            <div class="email-header-icon">✉️</div>
            <h1 class="email-header-title">Verify Your Email</h1>
            <p class="email-header-subtitle">One step away from learning</p>
        </div>
        
        <div class="email-content">
            <p class="greeting">Welcome, ${firstName}! 👋</p>
            
            <p class="message">
                Thank you for joining ${COMPANY.name}! To complete your registration and unlock
                access to our courses, please verify your email address.
            </p>

            <!-- Verification Card -->
            <div class="info-card" style="text-align: center; padding: 32px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
                <p style="color: ${EMAIL_THEME.textMuted}; font-size: 14px; margin-bottom: 24px;">
                    Click the button below to verify your account
                </p>
                <a href="${verificationLink}" class="cta-button">
                    Verify My Email
                </a>
            </div>

            <!-- Alternative Link -->
            <div class="link-text">
                <strong style="color: ${EMAIL_THEME.textSecondary};">Button not working?</strong>
                <br><br>
                Copy and paste this link in your browser:
                <br>
                <a href="${verificationLink}">${verificationLink}</a>
            </div>

            <hr class="divider">

            <!-- Security Notice -->
            <div class="warning-box">
                ⏱️ This verification link expires in <strong>24 hours</strong>. 
                For security, please don't share this link with anyone.
            </div>

            <!-- Didn't Request -->
            <div style="background: ${EMAIL_THEME.cardBg}; border-radius: 8px; padding: 20px; margin-top: 24px;">
                <p style="font-size: 14px; font-weight: 600; color: ${EMAIL_THEME.textPrimary}; margin: 0 0 8px 0;">
                    Didn't create an account?
                </p>
                <p style="font-size: 13px; color: ${EMAIL_THEME.textMuted}; margin: 0;">
                    If you didn't sign up for ${COMPANY.name}, you can safely ignore this email.
                    Someone may have entered your email by mistake.
                </p>
            </div>
        </div>

        ${getEmailFooter()}
    `;

    return getEmailWrapper('Verify Your Email - ' + COMPANY.name, content);
};
