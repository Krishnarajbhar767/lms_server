import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { ApiError } from "../utils/api_error.utils";
import crypto from "crypto";

/**
 * Generate unique certificate ID
 * Format: CERT-YYYY-XXXXXXXX
 */
function generateCertificateId(): string {
    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `CERT-${year}-${randomPart}`;
}

/**
 * Get all certificates for the authenticated user
 * Also returns enrolled courses with progress to show certificate eligibility
 * GET /api/certificate/my-certificates
 */
export const getUserCertificates = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    // Get all enrollments with course details and progress
    const enrollments = await prisma.enrollment.findMany({
        where: { userId },
        include: {
            course: {
                select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                }
            }
        }
    });

    // Get progress for all enrolled courses
    const progressRecords = await prisma.courseProgress.findMany({
        where: { userId },
        select: {
            courseId: true,
            percentage: true,
        }
    });

    // Create a map for quick progress lookup
    const progressMap = new Map(progressRecords.map(p => [p.courseId, p.percentage]));

    // Get existing certificates
    const certificates = await prisma.certificate.findMany({
        where: { userId },
        include: {
            course: {
                select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                }
            }
        }
    });

    // Create certificate map for quick lookup
    const certificateMap = new Map(certificates.map(c => [c.courseId, c]));

    // Build response with course progress and certificate status
    const coursesWithCertificateStatus = enrollments.map(enrollment => {
        const progress = progressMap.get(enrollment.courseId) ?? 0;
        const certificate = certificateMap.get(enrollment.courseId);
        
        return {
            courseId: enrollment.courseId,
            courseName: enrollment.course.title,
            thumbnail: enrollment.course.thumbnail,
            progress: Math.round(progress),
            isEligible: progress >= 100,
            certificate: certificate ? {
                id: certificate.id,
                certificateId: certificate.certificateId,
                issuedAt: certificate.issuedAt,
            } : null,
        };
    });

    return res.status(200).json({
        success: true,
        message: "Certificates fetched",
        data: coursesWithCertificateStatus
    });
});

/**
 * Claim certificate for a completed course
 * Creates certificate if eligible and not already claimed
 * POST /api/certificate/claim/:courseId
 */
export const claimCertificate = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);
    const courseId = Number(req.params.courseId);

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
        where: { userId, courseId }
    });

    if (!enrollment) {
        throw new ApiError(403, "You are not enrolled in this course");
    }

    // Check progress
    const progress = await prisma.courseProgress.findFirst({
        where: { userId, courseId }
    });

    if (!progress || progress.percentage < 100) {
        throw new ApiError(400, "You must complete 100% of the course to claim a certificate");
    }

    // Check if certificate already exists
    const existingCertificate = await prisma.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
        include: {
            course: { select: { title: true } },
            user: { select: { firstName: true, lastName: true } }
        }
    });

    if (existingCertificate) {
        return res.status(200).json({
            success: true,
            message: "Certificate already claimed",
            data: {
                certificateId: existingCertificate.certificateId,
                courseName: existingCertificate.course.title,
                studentName: `${existingCertificate.user.firstName} ${existingCertificate.user.lastName}`,
                issuedAt: existingCertificate.issuedAt,
            }
        });
    }

    // Create new certificate
    const certificate = await prisma.certificate.create({
        data: {
            certificateId: generateCertificateId(),
            userId,
            courseId,
        },
        include: {
            course: { select: { title: true } },
            user: { select: { firstName: true, lastName: true } }
        }
    });

    return res.status(201).json({
        success: true,
        message: "Certificate claimed successfully",
        data: {
            certificateId: certificate.certificateId,
            courseName: certificate.course.title,
            studentName: `${certificate.user.firstName} ${certificate.user.lastName}`,
            issuedAt: certificate.issuedAt,
        }
    });
});

/**
 * Verify certificate by certificateId (Public endpoint)
 * GET /api/certificate/verify/:certificateId
 */
export const verifyCertificate = asyncHandler(async (req: Request, res: Response) => {
    const { certificateId } = req.params;

    // Validate certificateId param
    if (!certificateId) {
        throw new ApiError(400, "Certificate ID is required");
    }

    const certificate = await prisma.certificate.findUnique({
        where: { certificateId: certificateId.toUpperCase() },
        include: {
            course: { select: { id: true, title: true } },
            user: { select: { firstName: true, lastName: true } }
        }
    });

    if (!certificate) {
        throw new ApiError(404, "Certificate not found or invalid");
    }

    return res.status(200).json({
        success: true,
        message: "Certificate verified",
        data: {
            certificateId: certificate.certificateId,
            courseName: certificate.course.title,
            studentName: `${certificate.user.firstName} ${certificate.user.lastName}`,
            issuedAt: certificate.issuedAt,
            isValid: true,
        }
    });
});
