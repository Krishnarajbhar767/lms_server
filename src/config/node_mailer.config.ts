import nodemailer from 'nodemailer';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

// mailgun environment variables
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL;

// check if mailgun is fully configured
const isMailgunConfigured = Boolean(MAILGUN_API_KEY && MAILGUN_DOMAIN);

// initialize mailgun client only if configured
let mailgunClient: ReturnType<InstanceType<typeof Mailgun>['client']> | null = null;

if (isMailgunConfigured && MAILGUN_API_KEY) {
  try {
    const mailgun = new Mailgun(FormData);
    mailgunClient = mailgun.client({
      username: 'api',
      key: MAILGUN_API_KEY,
    });
  } catch (error: any) {
    console.error(`[MAILGUN] Failed to initialize client: ${error.message || error}`);
  }
}

// existing nodemailer transport
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 50,
});

// internal function to send email via mailgun sdk
async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<boolean> {
  if (!mailgunClient || !MAILGUN_DOMAIN) {
    return false;
  }

  try {
    const data = await mailgunClient.messages.create(MAILGUN_DOMAIN, {
      from: MAILGUN_FROM_EMAIL || from,
      to: [to],
      subject,
      html,
    });

    console.log(`[MAILGUN] Email sent successfully to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`[MAILGUN] Error sending email: ${error.message || error}`);
    return false;
  }
}
// enhanced sendmail function with mailgun primary and nodemailer fallback
export async function sendMailWithProvider(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<any> {
  let mailgunAttempted = false;

  // STEP 1: Try Mailgun if configured
  if (isMailgunConfigured && mailgunClient) {
    mailgunAttempted = true;
    const mailgunSuccess = await sendViaMailgun(to, subject, html, from);
    
    if (mailgunSuccess) {
      // Success, return immediately (no fallback needed)
      return { provider: 'mailgun', success: true };
    }
    
    // Mailgun failed, log and proceed to fallback
    console.warn(`[EMAIL] Mailgun failed for ${to}, falling back to Nodemailer`);
  }

  // STEP 2: Use Nodemailer (either as fallback or primary if Mailgun not configured)
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    
    const provider = mailgunAttempted ? 'nodemailer-fallback' : 'nodemailer';
    console.log(`[${provider.toUpperCase()}] Email sent successfully to ${to}`);
    
    return { provider, success: true, info };
  } catch (error: any) {
    // Both providers failed or Nodemailer is the only option and it failed
    console.error(`[EMAIL] All providers failed for ${to}: ${error.message || error}`);
    throw error;
  }
}
