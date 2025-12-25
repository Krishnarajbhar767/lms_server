import { Router } from 'express';
import { authRouter } from './routes/auth.routes';
import { categoryRouter } from './routes/category.routes';
import { courseRouter } from './routes/course.routes';
import { sectionRouter } from './routes/section.routes';
import lessonRouter from './routes/lesson.routes';
import bunnyRouter from './routes/bunny.routes';
import { quizeRouter } from './routes/quize.routes';
import { isAdmin, isAuthenticated } from './middleware/auth.middleware';


const router = Router();

// Auth Routes
router.use('/auth', authRouter);
// Category Routes
router.use('/categories', categoryRouter);
// Course Routes
router.use('/courses', courseRouter);
// Section Routes
router.use('/sections', sectionRouter);
// Lesson Routes
router.use('/lessons', lessonRouter);
// Bunny Routes
router.use('/bunny', isAuthenticated, isAdmin, bunnyRouter);
// Quize Routes
router.use('/quizes', quizeRouter);


export default router;