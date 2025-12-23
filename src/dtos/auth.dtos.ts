import z from 'zod';
import { changePasswordSchema, forgotPasswordResetSchema, forgotPasswordSchema, loginSchema, registerWithOtpSchema } from '../validation/auth.validation';

export type RegisterDTO = z.infer<typeof registerWithOtpSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ForgotPasswordResetDTO = z.infer<typeof forgotPasswordResetSchema>;
