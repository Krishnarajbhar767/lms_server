
import { logger } from '../config/logger.config';
import { transporter, sendMailWithProvider } from '../config/node_mailer.config';
import { ApiError } from './api_error.utils';
import { COMPANY } from '../COMPANY';
export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    const EMAIL_USER = process.env.EMAIL_USER;
    const from = `${COMPANY.name} <${EMAIL_USER}>`;
    
    // use enhanced provider mailgun primary nodemailer fallback
    const info = await sendMailWithProvider(to, subject, html, from);
    
    logger.info(`Email sent to ${to}`);
    return info;
  } catch (error: any) {
    logger.error(`Unable to send email: ${error.message || error}`);
    throw new ApiError(500, error.message || error || "INTERNAL_SERVER_ERROR");
  }
};
