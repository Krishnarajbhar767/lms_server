import { COMPANY } from '../COMPANY';

interface AccountVerificationTemplateParams {
    firstName: string;
    verificationLink: string;
}

export const accountVerificationTemplate = (
    params: AccountVerificationTemplateParams
): string => {
    const { firstName, verificationLink } = params;

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Verification</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f9f9f9;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 30px 20px;
                    text-align: center;
                    color: #ffffff;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }
                .logo {
                    font-size: 14px;
                    opacity: 0.9;
                    margin-top: 8px;
                }
                .content {
                    padding: 40px 30px;
                }
                .greeting {
                    font-size: 16px;
                    margin-bottom: 20px;
                    color: #333;
                }
                .message {
                    font-size: 14px;
                    line-height: 1.8;
                    margin-bottom: 30px;
                    color: #555;
                }
                .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #ffffff !important;
                    padding: 14px 32px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 15px;
                    margin-bottom: 20px;
                    transition: opacity 0.3s;
                }
                .cta-button:hover {
                    opacity: 0.9;
                }
                .link-text {
                    font-size: 12px;
                    word-break: break-all;
                    color: #667eea;
                    margin-top: 10px;
                }
                .divider {
                    border: 0;
                    border-top: 1px solid #e0e0e0;
                    margin: 30px 0;
                }
                .footer {
                    background-color: #f5f5f5;
                    padding: 20px 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #888;
                }
                .footer-link {
                    color: #667eea;
                    text-decoration: none;
                }
                .warning {
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 12px 16px;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #856404;
                    border-radius: 4px;
                }
                @media (max-width: 600px) {
                    .container {
                        margin: 0;
                        border-radius: 0;
                    }
                    .content {
                        padding: 30px 20px;
                    }
                    .header {
                        padding: 20px 15px;
                    }
                    .header h1 {
                        font-size: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✉️ Verify Your Account</h1>
                    <div class="logo">${COMPANY.name}</div>
                </div>
                <div class="content">
                    <p class="greeting">Hi ${firstName},</p>
                    <p class="message">
                        Welcome to ${COMPANY.name}! We're excited to have you on board. To complete your account setup and secure your account, please verify your email address by clicking the button below.
                    </p>
                    <a href="${verificationLink}" class="cta-button">Verify Your Email</a>
                    <div class="link-text">
                        <strong>Or copy this link:</strong><br>
                        ${verificationLink}
                    </div>
             
                    <hr class="divider">
                    <p class="message" style="margin-bottom: 10px; font-size: 13px;">
                        <strong>Didn't request this?</strong><br>
                        If you didn't create this account, please ignore this email or contact our support team immediately.
                    </p>
                </div>
                <div class="footer">
                    <p style="margin: 0 0 10px 0;">
                        © ${new Date().getFullYear()} ${COMPANY.name}. All rights reserved.
                    </p>
                    <p style="margin: 0;">
                        <a href="${COMPANY.website}" class="footer-link">Visit Our Website</a> • 
                        <a href="${COMPANY.email}" class="footer-link">Contact Support</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
};
