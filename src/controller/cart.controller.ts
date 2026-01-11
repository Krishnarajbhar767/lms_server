import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { prisma } from "../prisma";
import { ValidationError, NotFoundError } from "../utils/api_error.utils";
import { AddToCartDto, RemoveFromCartDto } from "../dtos/cart.dtos";

const getOrCreateCart = async (userId: number) => {
    let cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { userId }
        });
    }

    return cart;
};

const calculateCartTotals = (items: { course: { price: number; originalPrice: number | null } }[]) => {
    let totalPrice = 0;
    let totalOriginalPrice = 0;

    for (const item of items) {
        totalPrice += item.course.price;
        totalOriginalPrice += item.course.originalPrice || item.course.price;
    }

    const totalSavings = totalOriginalPrice - totalPrice;

    return {
        totalPrice: Math.round(totalPrice * 100) / 100,
        totalOriginalPrice: Math.round(totalOriginalPrice * 100) / 100,
        totalSavings: Math.round(totalSavings * 100) / 100,
        itemCount: items.length
    };
};

export const getCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    // Get or create cart
    const cart = await getOrCreateCart(userId);

    // Fetch cart with items and full course details
    const cartWithItems = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
            items: {
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            price: true,
                            originalPrice: true,
                            thumbnail: true,
                            status: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { addedAt: "desc" } // Most recently added first
            }
        }
    });

    // Calculate totals
    const totals = calculateCartTotals(cartWithItems?.items || []);

    res.success("Cart fetched successfully", {
        cart: cartWithItems,
        ...totals
    });
});

export const addToCart = asyncHandler(async (req: Request<{}, {}, AddToCartDto>, res: Response) => {
    const userId = Number(req.user.id);
    const { courseId } = req.body;

    // 1. Check if course exists
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            id: true,
            title: true,
            status: true,
            price: true,
            originalPrice: true,
            thumbnail: true
        }
    });

    if (!course) {
        throw new NotFoundError("Course not found");
    }

    // 2. Check if course is published
    if (course.status !== "PUBLISHED") {
        throw new ValidationError("This course is not available for purchase");
    }

    // 3. Check if user is already enrolled in this course
    const existingEnrollment = await prisma.enrollment.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (existingEnrollment) {
        throw new ValidationError("You are already enrolled in this course");
    }

    // 4. Get or create cart
    const cart = await getOrCreateCart(userId);

    // 5. Check if course is already in cart
    const existingCartItem = await prisma.cartItem.findUnique({
        where: {
            cartId_courseId: {
                cartId: cart.id,
                courseId
            }
        }
    });

    if (existingCartItem) {
        throw new ValidationError("This course is already in your cart");
    }

    // 6. Add course to cart
    const cartItem = await prisma.cartItem.create({
        data: {
            cartId: cart.id,
            courseId
        },
        include: {
            course: {
                select: {
                    id: true,
                    title: true,
                    price: true,
                    originalPrice: true,
                    thumbnail: true
                }
            }
        }
    });

    // 7. Get updated cart item count
    const itemCount = await prisma.cartItem.count({
        where: { cartId: cart.id }
    });

    res.success("Course added to cart successfully", {
        cartItem,
        itemCount
    }, 201);
});


export const removeFromCart = asyncHandler(async (req: Request<{}, {}, RemoveFromCartDto>, res: Response) => {
    const userId = Number(req.user.id);
    const { courseId } = req.body;

    // 1. Get user's cart
    const cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        throw new NotFoundError("Cart not found");
    }

    // 2. Check if course is in cart
    const existingCartItem = await prisma.cartItem.findUnique({
        where: {
            cartId_courseId: {
                cartId: cart.id,
                courseId
            }
        }
    });

    if (!existingCartItem) {
        throw new NotFoundError("This course is not in your cart");
    }

    // 3. Remove from cart
    await prisma.cartItem.delete({
        where: { id: existingCartItem.id }
    });

    // 4. Get updated cart item count
    const itemCount = await prisma.cartItem.count({
        where: { cartId: cart.id }
    });

    res.success("Course removed from cart successfully", {
        removedCourseId: courseId,
        itemCount
    });
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    // 1. Get user's cart
    const cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        // No cart means nothing to clear - return success
        res.success("Cart cleared successfully", { removedCount: 0 });
        return;
    }

    // 2. Count items before deletion (for response)
    const itemCount = await prisma.cartItem.count({
        where: { cartId: cart.id }
    });

    // 3. Delete all cart items
    await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
    });

    res.success("Cart cleared successfully", {
        removedCount: itemCount
    });
});

export const getCartItemCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.user.id);

    // Get user's cart
    const cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        res.success("Cart item count fetched successfully", { count: 0 });
        return;
    }

    const count = await prisma.cartItem.count({
        where: { cartId: cart.id }
    });

    res.success("Cart item count fetched successfully", { count });
});


export const checkCourseInCart = asyncHandler(async (req: Request<{ courseId: string }>, res: Response) => {
    const userId = Number(req.user.id);
    const courseId = Number(req.params.courseId);

    // Validate courseId
    if (isNaN(courseId) || courseId <= 0) {
        throw new ValidationError("Invalid course ID");
    }

    // Get user's cart
    const cart = await prisma.cart.findUnique({
        where: { userId }
    });

    if (!cart) {
        res.success("Course cart status checked", { inCart: false });
        return;
    }

    // Check if course is in cart
    const cartItem = await prisma.cartItem.findUnique({
        where: {
            cartId_courseId: {
                cartId: cart.id,
                courseId
            }
        }
    });

    res.success("Course cart status checked", {
        inCart: !!cartItem,
        courseId
    });
});
