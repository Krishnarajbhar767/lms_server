import { COMPANY } from '../COMPANY';

/**
 * Email Theme Colors - Matching LMS Dark Premium Theme
 * Background: #000814 (richblack-900) / #161D29 (richblack-800)
 * Text: #F1F2FF (richblack-5)
 * Accent: #FFD60A (yellow-50)
 * Success: #06D6A0 (caribbeangreen-100)
 * Muted: #838894 (richblack-300)
 */
export const EMAIL_THEME = {
    // Dark backgrounds
    bodyBg: '#000814',
    containerBg: '#161D29',
    cardBg: '#2C333F',
    
    // Text colors
    textPrimary: '#F1F2FF',
    textSecondary: '#C5C7D4',
    textMuted: '#838894',
    
    // Accent colors
    accent: '#FFD60A',
    accentHover: '#E7C009',
    accentGradient: 'linear-gradient(135deg, #FFD60A 0%, #E7C009 100%)',
    
    // Status colors
    success: '#06D6A0',
    successBg: 'rgba(6, 214, 160, 0.2)',
    successBorder: 'rgba(6, 214, 160, 0.4)',
    warning: '#FFD166',
    warningBg: 'rgba(255, 209, 102, 0.15)',
    error: '#EF476F',
    
    // Border
    border: '#2C333F',
    borderLight: '#424854',
};

/**
 * Base email layout wrapper - premium dark theme
 */
export const emailBaseStyles = `
    body {
        font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: ${EMAIL_THEME.bodyBg};
        color: ${EMAIL_THEME.textPrimary};
        -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
        max-width: 600px;
        margin: 0 auto;
        padding: 40px 20px;
    }
    .email-container {
        background: ${EMAIL_THEME.containerBg};
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid ${EMAIL_THEME.border};
    }
    .email-header {
        background: linear-gradient(135deg, ${EMAIL_THEME.containerBg} 0%, ${EMAIL_THEME.cardBg} 100%);
        padding: 40px 32px;
        text-align: center;
        border-bottom: 1px solid ${EMAIL_THEME.border};
    }
    .email-logo {
        font-size: 28px;
        font-weight: 700;
        color: ${EMAIL_THEME.accent};
        margin-bottom: 8px;
        letter-spacing: -0.5px;
    }
    .email-header-icon {
        font-size: 48px;
        margin-bottom: 16px;
    }
    .email-header-title {
        font-size: 24px;
        font-weight: 600;
        color: ${EMAIL_THEME.textPrimary};
        margin: 0;
    }
    .email-header-subtitle {
        font-size: 14px;
        color: ${EMAIL_THEME.textMuted};
        margin-top: 8px;
    }
    .email-content {
        padding: 40px 32px;
    }
    .greeting {
        font-size: 18px;
        font-weight: 600;
        color: ${EMAIL_THEME.textPrimary};
        margin-bottom: 16px;
    }
    .message {
        font-size: 15px;
        line-height: 1.7;
        color: ${EMAIL_THEME.textSecondary};
        margin-bottom: 24px;
    }
    .cta-button {
        display: inline-block;
        background: ${EMAIL_THEME.accent};
        color: #000814 !important;
        padding: 14px 32px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        text-align: center;
        transition: all 0.2s ease;
    }
    .cta-button:hover {
        background: ${EMAIL_THEME.accentHover};
    }
    .secondary-button {
        display: inline-block;
        background: transparent;
        color: ${EMAIL_THEME.accent} !important;
        padding: 12px 24px;
        border: 2px solid ${EMAIL_THEME.accent};
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
    }
    .info-card {
        background: ${EMAIL_THEME.cardBg};
        border-radius: 12px;
        padding: 20px 24px;
        margin: 24px 0;
        border: 1px solid ${EMAIL_THEME.borderLight};
    }
    .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 0;
        border-bottom: 1px solid ${EMAIL_THEME.border};
        gap: 16px;
    }
    .info-row:last-child {
        border-bottom: none;
    }
    .info-label {
        font-size: 13px;
        color: ${EMAIL_THEME.textMuted};
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .info-value {
        font-size: 15px;
        font-weight: 600;
        color: ${EMAIL_THEME.textPrimary};
    }
    .success-badge {
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
    }
    .warning-box {
        background: ${EMAIL_THEME.warningBg};
        border-left: 4px solid ${EMAIL_THEME.warning};
        padding: 16px 20px;
        border-radius: 8px;
        margin: 24px 0;
        font-size: 14px;
        color: ${EMAIL_THEME.warning};
    }
    .link-text {
        font-size: 12px;
        color: ${EMAIL_THEME.textMuted};
        word-break: break-all;
        margin-top: 16px;
        padding: 16px;
        background: ${EMAIL_THEME.cardBg};
        border-radius: 8px;
    }
    .link-text a {
        color: ${EMAIL_THEME.accent};
        text-decoration: none;
    }
    .divider {
        border: 0;
        border-top: 1px solid ${EMAIL_THEME.border};
        margin: 32px 0;
    }
    .email-footer {
        background: ${EMAIL_THEME.bodyBg};
        padding: 32px;
        text-align: center;
        border-top: 1px solid ${EMAIL_THEME.border};
    }
    .footer-brand {
        font-size: 16px;
        font-weight: 600;
        color: ${EMAIL_THEME.accent};
        margin-bottom: 16px;
    }
    .footer-links {
        margin-bottom: 16px;
    }
    .footer-link {
        color: ${EMAIL_THEME.textMuted};
        text-decoration: none;
        font-size: 13px;
        margin: 0 12px;
    }
    .footer-link:hover {
        color: ${EMAIL_THEME.accent};
    }
    .footer-copy {
        font-size: 12px;
        color: ${EMAIL_THEME.textMuted};
        margin: 0;
    }
    .social-icons {
        margin-top: 20px;
    }
    .social-icon {
        display: inline-block;
        width: 36px;
        height: 36px;
        background: ${EMAIL_THEME.cardBg};
        border-radius: 50%;
        margin: 0 6px;
        line-height: 36px;
        text-align: center;
        color: ${EMAIL_THEME.textMuted};
        text-decoration: none;
        font-size: 14px;
    }
    @media (max-width: 600px) {
        .email-wrapper {
            padding: 16px 8px;
        }
        .email-header, .email-content, .email-footer {
            padding: 24px 16px;
        }
        .email-header-title {
            font-size: 20px;
        }
        .info-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }
        .info-label {
            font-size: 11px;
        }
        .info-value {
            font-size: 14px;
        }
        .success-badge {
            padding: 10px 20px;
            font-size: 13px;
        }
    }
`;

/**
 * Generate base HTML wrapper for all emails
 */
export const getEmailWrapper = (title: string, content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${title}</title>
    <style>${emailBaseStyles}</style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            ${content}
        </div>
    </div>
</body>
</html>
`;

/**
 * Generate email footer
 */
export const getEmailFooter = (): string => `
<div class="email-footer">
    <div class="footer-brand">${COMPANY.name}</div>
    <div class="footer-links">
        <a href="${COMPANY.website}" class="footer-link">Website</a>
        <a href="mailto:${COMPANY.email}" class="footer-link">Support</a>
    </div>
    <p class="footer-copy">
        © ${new Date().getFullYear()} ${COMPANY.name}. All rights reserved.
    </p>
</div>
`;
