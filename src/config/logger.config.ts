
import { createLogger, format, transports } from 'winston';

const isProd = process.env.NODE_ENV === 'production';

export const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    isProd
      ? format.json()
      : format.printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} [${level}]: ${stack || message}`;
        })
  ),
  transports: [
    new transports.Console(),
    ...(isProd
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' })
        ]
      : [])
  ]
});


