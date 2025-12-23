
// import { logger } from '../config/logger.config';
// import { transporter } from '../config/node_mailer.config';
// import { ApiError } from './api_error.utils.';

// export const sendMail = async (to: string, subject: string, html: string) => {
//   try {
//     // not using await here to avoid blocking
//     const info = await transporter.sendMail({
//       from: `"QURAN LMS" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html,
//     });
//     logger.info(`Email sent to ${to}`);
//     return info;
//   } catch (error: any) {
//     logger.error(`Unable to send email: ${error.message || error}`);
//     throw new ApiError(429, `Unable to send email: ${error.message || error}`);
//   }
// };
import { Resend } from "resend";
import { logger } from "../config/logger.config";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    logger.info(`Message send to ${to}`)

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });


    logger.info("✅ Resend result:", result)
    return result;
  } catch (err) {
    logger.error("❌ Resend error:", err)
    throw err;
  }
};
