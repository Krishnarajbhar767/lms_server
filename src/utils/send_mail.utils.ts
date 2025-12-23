
import { transporter } from '../config/node_mailer.config';
import { ApiError } from './api_error.utils.';



export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    // not using await here to avoid blocking
    const info = transporter.sendMail({
      from: `"Battle Bounty" <${process.env.EMAIL_USER}>`, 
      to,
      subject,
      html,
    });

    return info;
  } catch (error: any) {
    throw new ApiError(429, `Unable to send email: ${error.message || error}`);
  }
};