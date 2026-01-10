import e from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { getProtectedResource, getResourceMetadata } from "../controller/resource.controller";

const resourceRouter = e.Router();

// Protected resource access - requires authentication and enrollment
resourceRouter.get("/metadata/:resourceId", isAuthenticated, getResourceMetadata);
resourceRouter.get("/view/:resourceId", isAuthenticated, getProtectedResource);

export default resourceRouter;
