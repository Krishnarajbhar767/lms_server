

import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { ApiError } from "../utils/api_error.utils.";
import { ChangePasswordDTO, ForgotPasswordDTO, ForgotPasswordResetDTO, LoginDTO, RegisterDTO } from "../dtos/auth.dtos";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { accountVerificationTemplate } from "../template/account-verification.template";

import { sendMail } from "../utils/send_mail.utils";
import { accountVerificationSuccessTemplate } from "../template/verification-success.templte";
import { ROLE } from "../global.types";
import { forgotPasswordTemplate } from "../template/forgot-password.template";

export const register = asyncHandler(async (req: Request<{}, {}, RegisterDTO>, res: Response) => {
    const { firstName, lastName, email, password } = req.body;
    // step 1 : check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser && existingUser.isActive) {
        throw new ApiError(400, 'Email already exists');
    }
    if (existingUser && !existingUser.isActive) {
        throw new ApiError(400, 'Please verify your email to activate your account. Check your inbox for verification email');
    }
    // step 2 : hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // step 2.1 : prepare user data
    const userData = {
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase(),
        email: email.toLowerCase(),
        password: hashedPassword,

    };
    // step 3 : create user
    const user = await prisma.user.create({ data: userData });
    // step 4 : create jwt token for email verification
    const verificationToken = jwt.sign({ email: user.email }, process.env.EMAIL_VERIFICATION_SECRET as string);
    // step 5 : main verification url
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    // step 6 : generate email template
    const emailTemplate = accountVerificationTemplate({ firstName: user.firstName, verificationLink })    // step 8 : send email
    try {
        await sendMail(user.email, 'Account Verification', emailTemplate);
    } catch (error) {
        // if email fails to send, delete user
        await prisma.user.delete({ where: { id: user.id } });
        throw new ApiError(500, 'Failed to send verification email. Please try again later');
    }
    res.success('User registered successfully', 201);
});

export const verifyEmail = asyncHandler(async (req: Request<{ token: string }, {}, { token: string }>, res: Response) => {
    const token = req.body.token || req.params.token;
    if (!token) {
        throw new ApiError(400, 'Verification token is required');
    }
    // verify token
    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET as string) as { email: string };
    } catch (error) {
        throw new ApiError(400, 'Invalid or expired verification token');
    }
    // step 2 : find user by email
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // step 2.1 : check if user is already verified
    if (user.isActive) {
        throw new ApiError(400, 'Email is already verified');
    }
    // step 3 : update user's isEmailVerified to true
    await prisma.user.update({ where: { email: user.email }, data: { isActive: true } });
    // generate account verified email template 
    const emailTemplate = accountVerificationSuccessTemplate(user.firstName)
    // send account verified email
    sendMail(user.email, 'Email Verified Successfully', emailTemplate);
    res.success('Email verified successfully');
})

export const login = asyncHandler(async (req: Request<{}, {}, LoginDTO>, res: Response) => {
    const { email, password } = req.body;
    // step 1 : find user by email
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    // check if user is active
    if (!user.isActive) {
        throw new ApiError(403, 'Please verify your email to activate your account');
    }

    // step 2 : compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
    }
    // step 3 : generate access token and refresh token
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: '30m' }
    );

    const refreshToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: '7d' }
    );

    // send refresh token as cookies
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    // step 5 : send response
    res.success(`Welcome ${user.firstName}`, accessToken)
})

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new ApiError(401, 'Refresh token is required');
    }
    // step 2 : verify refresh token
    let decoded: any;
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { id: string, email: string, role: ROLE };
    } catch (error) {
        throw new ApiError(401, 'Invalid refresh token');
    }
    // step 3 : find user by id
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    // step 4 : generate access token and refresh token
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: '30m' }
    );

    const newRefreshToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: '7d' }
    );

    // send refresh token as cookies
    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.success('Refresh token generated successfully', { accessToken })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new ApiError(401, 'Refresh token is required');
    }
    res.clearCookie('refreshToken');
    res.success('User logged out successfully');

})

export const changePassword = asyncHandler(async (req: Request<{}, {}, ChangePasswordDTO>, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    // step 1 : find user by id
    const user = await prisma.user.findUnique({ where: { email: req.user.email } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    // step 2 : compare old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Old password is incorrect');
    }
    // step 3 : hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // step 4 : update user's password
    await prisma.user.update({ where: { email: user.email }, data: { password: hashedPassword, passwordResetToken: null } });
    res.success('Password changed successfully');
})

export const forgotPasswordRequest = asyncHandler(async (req: Request<{}, {}, ForgotPasswordDTO>, res: Response) => {
    const { email } = req.body;

    // step 1 : find user by email
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    // check if user is active
    if (!user.isActive) {
        throw new ApiError(403, 'Please verify your email to reset your password');
    }
    // step 2 : generate forgot password token
    const passwordResetToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.FORGOT_PASSWORD_SECRET as string,
        { expiresIn: '15m' }
    );

    // step 3 : update user's forgot password token
    await prisma.user.update({ where: { email: user.email }, data: { passwordResetToken } });
    // step 4 : generate forgot password link
    const forgotPasswordLink = `${process.env.FRONTEND_URL}/reset-password?token=${passwordResetToken}`;
    // step 5 : generate forgot password email template
    const emailTemplate = forgotPasswordTemplate({ firstName: user.firstName, forgotPasswordLink });
    // step 6 : send forgot password email
    sendMail(user.email, 'Forgot Password', emailTemplate);
    res.success('Forgot password email sent successfully');
})

export const forgotPasswordReset = asyncHandler(async (req: Request<{}, {}, ForgotPasswordResetDTO>, res: Response) => {
    const { token, password } = req.body;
    // step 1 : verify forgot password token
    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.FORGOT_PASSWORD_SECRET as string) as { id: string, email: string, role: ROLE };
    } catch (error) {
        throw new ApiError(401, 'Link is expired. Request for new link');
    }
    // step 2 : find user by email
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // check is given token and user token is same or not
    if (user.passwordResetToken !== token) {
        throw new ApiError(401, 'Link is expired');
    }
    // step 3 : hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    // step 4 : update user's password
    await prisma.user.update({ where: { email: user.email }, data: { password: hashedPassword, passwordResetToken: null } });
    // step 5 : invalidate token without db
    res.success('Password reset successfully');
})

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { email: req.user.email } });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    const data = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    }
    res.success('User profile fetched successfully', data, 200);
})
