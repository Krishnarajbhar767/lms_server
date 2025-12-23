import e from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { createCourseSchema } from "../validation/course.validation";
import { archiveCourse, uploadThumbnailController, createCourse, getAllCoursesForAdmin, getCourseById, getAllCoursesForStudent, updateCourse, updateCourseStatus } from "../controller/course.controller";
export const courseRouter = e.Router()
courseRouter.post("/upload-thumbnail", isAuthenticated, isAdmin, uploadThumbnailController)
courseRouter.post("/create", isAuthenticated, isAdmin, validate(createCourseSchema), createCourse)
courseRouter.put("/update/:id", isAuthenticated, isAdmin, validate(createCourseSchema), updateCourse)
courseRouter.delete("/archive/:id", isAuthenticated, isAdmin, archiveCourse)
courseRouter.get("/admin", isAuthenticated, isAdmin, getAllCoursesForAdmin)
courseRouter.get("/", getAllCoursesForStudent)
courseRouter.get("/:id", getCourseById)
courseRouter.post('/update-status/:id', isAuthenticated, isAdmin, updateCourseStatus)




