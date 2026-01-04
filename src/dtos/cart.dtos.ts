import { addToCartSchema, removeFromCartSchema, bulkAddToCartSchema } from "../validation/cart.validation";
import z from "zod";

/**
 * DTO for adding a single course to cart
 */
export type AddToCartDto = z.infer<typeof addToCartSchema>;

/**
 * DTO for removing a course from cart
 */
export type RemoveFromCartDto = z.infer<typeof removeFromCartSchema>;

/**
 * DTO for bulk adding courses to cart
 */
export type BulkAddToCartDto = z.infer<typeof bulkAddToCartSchema>;
