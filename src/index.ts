import express from 'express';
import cors from 'cors';

import helmet from 'helmet';
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

dotenv.config();
const app = express();
// use express file upload for get file from user
app.use(fileUpload({
  limits: {
    // allow user to upload  max  10 mb thumbnail
    fileSize: 1024 * 1024 * 10,
  },
}));
// Using compression
app.use(compression());
// using helmet to make header more secure
app.use(helmet());
// using morgan for logging requests
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    })
  );
} else {
  app.use(morgan('dev'));
}
// Let allow user file upload
app.use("/uploads", express.static(path.join(__dirname, "../uploads"), {
  setHeaders: (res, filePath) => {
    // 1. Fix the original error by adding this header
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // 2. Correct your MIME type logic (ensure correct extension check)
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

// Serving the new resource folder
app.use("/resource", express.static(path.join(__dirname, "../resource"), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Add content type headers if needed, similar to uploads
  }
}));

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// cors config

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
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
});