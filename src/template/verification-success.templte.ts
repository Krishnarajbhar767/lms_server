import { COMPANY } from "../COMPANY";

export const accountVerificationSuccessTemplate = (firstName: string): string => {
    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Verification Success</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background-color: #f5f5f5;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background-color: #ffffff;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 40px 20px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .content {
                        padding: 40px 20px;
                        text-align: center;
                    }
                    .success-icon {
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    .content h2 {
                        color: #333;
                        margin: 20px 0;
                        font-size: 24px;
                    }
                    .content p {
                        color: #666;
                        line-height: 1.6;
                        margin: 15px 0;
                    }
                    .cta-button {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 4px;
                        margin-top: 20px;
                        font-weight: bold;
                    }
                    .cta-button:hover {
                        opacity: 0.9;
                    }
                    .footer {
                        background-color: #f9f9f9;
                        padding: 20px;
                        text-align: center;
                        color: #999;
                        font-size: 12px;
                        border-top: 1px solid #eee;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome!</h1>
                    </div>
                    <div class="content">
                        <div class="success-icon">✔️</div>
                        <h2>Account Verified Successfully</h2>
                        <p>Congratulations, ${firstName}!</p>
                        <p>Your account has been verified and activated. You can now access all the features of our platform.</p>
                        <a href="${COMPANY.website}/login" class="cta-button">Go to Login</a>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} ${COMPANY.name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};
