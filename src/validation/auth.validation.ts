import { z } from 'zod';
export const baseRegisterSchema = z
  .object({
    firstName: z
      .string({ error: 'First name is required' })
      .min(2, 'First name must be at least 2 characters')
      .max(14),

    lastName: z.string({ error: 'Last name is required' }).min(2).max(14).toLowerCase(),

    email: z.string({ error: 'Email is required' }).email('Invalid email format').toLowerCase(),

    password: z
      .string({ error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters'),

    confirmPassword: z.string({ error: 'Confirm password is required' }).min(6, 'Confirm password must be at least 6 characters'),

    otp: z
      .string()
      .length(6, { message: 'OTP must be exactly 6 digits' })
      .regex(/^\d+$/, { message: 'OTP must contain only numbers' }).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
  });


// Variant 1: OTP required
export const registerWithOtpSchema = baseRegisterSchema.safeExtend({
  otp: baseRegisterSchema.shape.otp.refine((v) => !!v, {
    message: 'Otp is required',
  }),
});

//  Variant 2: OTP optional
export const registerWithoutOtpSchema = baseRegisterSchema;

export const loginSchema = z.object({
  email: z.email({ error: 'Valid email is required' }).toLowerCase(),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password cannot be less than 6 characters'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string({ error: 'Old password is required' }),
  newPassword: z.string({ error: 'New password is required' }).min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string({ error: 'Confirm password is required' }).min(6, 'Confirm password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  error: 'Passwords do not match',
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Valid email is required' }).toLowerCase(),
});

export const forgotPasswordResetSchema = z.object({
  token: z.string({ error: 'Token is required' }),
  password: z.string({ error: 'New password is required' }).min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string({ error: 'Confirm password is required' }).min(6, 'Confirm password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  error: 'Passwords do not match',
});
