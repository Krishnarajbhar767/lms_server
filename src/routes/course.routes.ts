import e from "express";
import { isAdmin, isAuthenticated, isStudent, optionalAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { createCourseSchema } from "../validation/course.validation";
import { archiveCourse, uploadThumbnailController, createCourse, getAllCoursesForAdmin, getCourseById, getAllCoursesForStudent, updateCourse, updateCourseStatus, clearAllCache, getEnrolledCourses } from "../controller/course.controller";
export const courseRouter = e.Router()
// Upload course thumbnail
courseRouter.post("/upload-thumbnail", isAuthenticated, isAdmin, uploadThumbnailController)

// Create a new course
courseRouter.post("/create", isAuthenticated, isAdmin, validate(createCourseSchema), createCourse)

// Update course details
courseRouter.put("/update/:id", isAuthenticated, isAdmin, validate(createCourseSchema), updateCourse)

// Archive a course
courseRouter.delete("/archive/:id", isAuthenticated, isAdmin, archiveCourse)

// Get all courses for administrative view
courseRouter.get("/admin", isAuthenticated, isAdmin, getAllCoursesForAdmin)

// Clear course-related cache
courseRouter.post("/clear-cache", isAuthenticated, isAdmin, clearAllCache)

// Get all available courses for students
courseRouter.get("/", getAllCoursesForStudent)

// Get courses current student is enrolled in
courseRouter.get('/enrolled', isAuthenticated, isStudent, getEnrolledCourses)

// Get specific course details by ID
courseRouter.get("/:id", optionalAuth, getCourseById)

// Update the status of a course
courseRouter.post('/update-status/:id', isAuthenticated, isAdmin, updateCourseStatus)




