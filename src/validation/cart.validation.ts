import z from "zod";

/**
 * Schema for adding a single course to cart
 * Validates that courseId is a positive integer
 */
export const addToCartSchema = z.object({
    courseId: z
        .number({ error: "Course ID is required and must be a number" })
        .int("Course ID must be an integer")
        .positive("Course ID must be a positive integer")
});

/**
 * Schema for removing a course from cart
 * Same validation as addToCart
 */
export const removeFromCartSchema = z.object({
    courseId: z
        .number({ error: "Course ID is required and must be a number" })
        .int("Course ID must be an integer")
        .positive("Course ID must be a positive integer")
});

/**
 * Schema for bulk adding courses to cart
 * Validates array of courseIds
 */
export const bulkAddToCartSchema = z.object({
    courseIds: z
        .array(
            z.number({ error: "Each course ID must be a number" })
                .int("Each course ID must be an integer")
                .positive("Each course ID must be a positive integer"),
            { error: "Course IDs array is required" }
        )
        .min(1, "At least one course ID is required")
        .max(50, "Cannot add more than 50 courses at once")
});
