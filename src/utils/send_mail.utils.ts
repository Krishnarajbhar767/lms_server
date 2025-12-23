
import { logger } from '../config/logger.config';
import { transporter } from '../config/node_mailer.config';
import { ApiError } from './api_error.utils.';



export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    // not using await here to avoid blocking
    const info = await transporter.sendMail({
      from: `"QURAN LMS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}`);
    return info;
  } catch (error: any) {
    logger.error(`Unable to send email: ${error.message || error}`);
    throw new ApiError(429, `Unable to send email: ${error.message || error}`);
  }
};