import e from "express";
import { createBunnyVideo, getBunnyConfig, getEmbedUrl, deleteLessonVideo } from "../controller/bunny.controller";
import { isAdmin, isAuthenticated } from "../middleware/auth.middleware";

const bunnyRouter = e.Router()
bunnyRouter.post("/create", isAuthenticated, isAdmin, createBunnyVideo)
bunnyRouter.get("/get-embed-url/:videoGuid", isAuthenticated, getEmbedUrl)
bunnyRouter.get('/config', isAuthenticated, getBunnyConfig)
bunnyRouter.delete('/:videoId', isAuthenticated, isAdmin, deleteLessonVideo)
export default bunnyRouter
