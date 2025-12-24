import e from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { createLessonSchema } from "../validation/lesson.validation";
import { createLesson, deleteResource, uploadResource, reorderLessons, deleteLesson, updateLesson, deleteResourceFile } from "../controller/lesson.controller";
import { deleteLessonVideo } from "../controller/bunny.controller";

const lessonRouter = e.Router()
lessonRouter.post("/create", isAuthenticated, isAdmin, validate(createLessonSchema), createLesson)
lessonRouter.post("/upload-resource", isAuthenticated, isAdmin, uploadResource)
// lessonRouter.delete('/delete-video/:videoId', isAuthenticated, isAdmin, deleteLessonVideo)
lessonRouter.delete('/resource/:id', isAuthenticated, isAdmin, deleteResource)
lessonRouter.delete('/resource/file', isAuthenticated, isAdmin, deleteResourceFile)
lessonRouter.delete("/:id", isAuthenticated, isAdmin, deleteLesson)
lessonRouter.put("/update/:id", isAuthenticated, isAdmin, updateLesson)
lessonRouter.put("/reorder/:sectionId", isAuthenticated, isAdmin, reorderLessons)
export default lessonRouter
