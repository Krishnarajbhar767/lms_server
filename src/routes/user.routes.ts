import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { getAllUsers, blockUser, unblockUser } from "../controller/user.controller";

const router = Router();

// all routes require admin
router.use(isAuthenticated, isAdmin);

// list users with pagination and filters
router.get("/", getAllUsers);

// block user
router.patch("/:id/block", blockUser);

// unblock user
router.patch("/:id/unblock", unblockUser);

export default router;
