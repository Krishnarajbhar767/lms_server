import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { validate } from "../middleware/zod_validate.middleware";
import { addToCartSchema, removeFromCartSchema } from "../validation/cart.validation";
import {
    getCart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartItemCount,
    checkCourseInCart
} from "../controller/cart.controller";

export const cartRouter = Router();

// ============================================================================
// All cart routes require authentication
// ============================================================================

/**
 * GET /cart
 * Get user's cart with all items and totals
 */
cartRouter.get("/", isAuthenticated, getCart);

/**
 * POST /cart/add
 * Add a course to cart
 * Body: { courseId: number }
 */
cartRouter.post("/add", isAuthenticated, validate(addToCartSchema), addToCart);

/**
 * DELETE /cart/remove
 * Remove a course from cart
 * Body: { courseId: number }
 */
cartRouter.delete("/remove", isAuthenticated, validate(removeFromCartSchema), removeFromCart);

/**
 * DELETE /cart/clear
 * Clear all items from cart
 */
cartRouter.delete("/clear", isAuthenticated, clearCart);

/**
 * GET /cart/count
 * Get the number of items in cart
 */
cartRouter.get("/count", isAuthenticated, getCartItemCount);

/**
 * GET /cart/check/:courseId
 * Check if a specific course is in cart
 */
cartRouter.get("/check/:courseId", isAuthenticated, checkCourseInCart);
