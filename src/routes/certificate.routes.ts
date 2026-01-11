import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { getUserCertificates, claimCertificate, verifyCertificate } from "../controller/certificate.controller";

export const certificateRouter = Router();

/**
 * GET /api/certificate/my-certificates
 * Get all enrolled courses with progress and certificate status
 * Auth: Student
 */
certificateRouter.get(
    "/my-certificates",
    isAuthenticated,
    getUserCertificates
);

/**
 * POST /api/certificate/claim/:courseId
 * Claim certificate for a completed course
 * Auth: Student
 */
certificateRouter.post(
    "/claim/:courseId",
    isAuthenticated,
    claimCertificate
);

/**
 * GET /api/certificate/verify/:certificateId
 * Public endpoint to verify a certificate
 * Auth: None (Public)
 */
certificateRouter.get(
    "/verify/:certificateId",
    verifyCertificate
);
