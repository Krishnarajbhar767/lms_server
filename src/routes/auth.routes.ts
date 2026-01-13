import express from 'express';

import {
  changePasswordSchema,
  forgotPasswordResetSchema,
  forgotPasswordSchema,
  loginSchema,
  registerWithoutOtpSchema,
  resendVerificationEmailSchema
} from '../validation/auth.validation';
import { validate } from '../middleware/zod_validate.middleware';

import { changePassword, forgotPasswordRequest, forgotPasswordReset, getProfile, login, logout, refreshToken, register, verifyEmail, resendVerificationEmail } from '../controller/auth.controller';
import { isAuthenticated } from '../middleware/auth.middleware';


export const authRouter = express.Router();
// Register New User
// https://localhost:3000/api/auth/register
authRouter.post('/register', validate(registerWithoutOtpSchema), register);
// Verify Registration OTP
// https://localhost:3000/api/auth/verify-email
authRouter.post('/verify-email', verifyEmail)
// Resend verification email (2 min cooldown)
// https://localhost:3000/api/auth/resend-verification
authRouter.post('/resend-verification', validate(resendVerificationEmailSchema), resendVerificationEmail)

// Login By Email Or Username
// https://localhost:3000/api/auth/login
authRouter.post('/login', validate(loginSchema), login);
// Refresh Tokens
// https://localhost:3000/api/auth/refresh-tokens
authRouter.post('/refresh-tokens', refreshToken);
// Logout
// https://localhost:3000/api/auth/logout
authRouter.post('/logout', logout);
// change password 
// https://localhost:3000/api/auth/change-password
authRouter.post('/change-password', isAuthenticated, validate(changePasswordSchema), changePassword);
// forgot password
// https://localhost:3000/api/auth/forgot-password-request
authRouter.post('/forgot-password-request', validate(forgotPasswordSchema), forgotPasswordRequest);
// forgot password reset
// https://localhost:3000/api/auth/forgot-password-reset
authRouter.post('/forgot-password-reset', validate(forgotPasswordResetSchema), forgotPasswordReset);
// get logged in user profile
// https://localhost:3000/api/auth/get-profile
authRouter.get('/get-profile', isAuthenticated, getProfile);



