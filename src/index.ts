import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import compression from 'compression';

import { responseHandler } from './middleware/response.middleware';
import { globalErrorHandler } from './middleware/error.middleware';

import { routeNotFound } from './middleware/route_not_found.middleware';
import router from './routes';
import dotenv from 'dotenv';
import { logger } from './config/logger.config';
import path from 'path';
import fileUpload from 'express-fileupload';
import cron from 'node-cron';
import { cleanupOldSessions } from './jobs/session-cleanup.job';

dotenv.config();
const app = express();
// Enable trust proxy for rate limiting behind proxies
app.set('trust proxy', 1);
// use express file upload for get file from user
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: {
    // allow user to upload  max  10 mb thumbnail
    fileSize: 1024 * 1024 * 10,
  },
}));
// Using compression
app.use(compression());
// using helmet to make header more secure
app.use(helmet());

// Rate limiting to prevent DDoS
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100, // 100 requests per windowMs per IP
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});
app.use(limiter);

// using morgan for logging requests
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    })
  );
}else{
  app.use(morgan('dev'));
}

app.use("/uploads", (req:Request, res:Response, next:NextFunction) => {
  // Block access to /resource directory (paid content)
  if (req.path.startsWith('/resource/') || req.path.includes('/resource/')) {
    return res.status(404).json({
      success: false,
      message: "Resource Are Not Allowed Publically"
    });
  }
  // Allow thumbnails 
  next();
}, express.static(path.join(__dirname, "../uploads"), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

app.use(
 cors({
  origin:"https://msmajadari.xyz",
  // origin:'http://localhost:5173',
  credentials:true
 })
);
// using cookies parser for safe cookies parsing
app.use(cookieParser());
// using express json middlewere for  parse JSON  Data
app.use(express.json());

//use Success Response middlewere
app.use(responseHandler);
app.get('/', (req, res) => {
  res.success('Backend Is Working  Fine.');
});
app.use('/api', router);
// Route Not Found middleware
app.use(routeNotFound);
// Global error handler (should be after routes)
app.use(globalErrorHandler);

app.listen(process.env.PORT, () => {
  logger.info(`Server running on  http://localhost:${process.env.PORT}`);

  // Schedule session cleanup job to run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled session cleanup');
    await cleanupOldSessions();
  });

  logger.info('Session cleanup job scheduled for 2 AM daily');
});
