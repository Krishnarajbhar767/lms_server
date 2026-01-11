import { Router } from "express"
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware"
import {
    submitReview,
    getCourseReviews,
    getUserReview,
    deleteReview,
    getAllReviewsForAdmin
} from "../controller/review.controller"

const reviewRouter = Router()

// Admin - Get all reviews (must be before /:courseId to avoid conflict)
reviewRouter.get("/admin/all", isAuthenticated, isAdmin, getAllReviewsForAdmin)

// Public - Get all reviews for a course
reviewRouter.get("/:courseId", getCourseReviews)

// Protected - Get current user's review for a course
reviewRouter.get("/user/:courseId", isAuthenticated, getUserReview)

// Protected - Submit or update a review
reviewRouter.post("/:courseId", isAuthenticated, submitReview)

// Admin only - Delete a review
reviewRouter.delete("/:reviewId", isAuthenticated, isAdmin, deleteReview)

export default reviewRouter
