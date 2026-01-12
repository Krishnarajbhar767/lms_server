import { prisma } from '../prisma';
import { logger } from '../config/logger.config';

export const cleanupOldSessions = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await prisma.session.deleteMany({
      where: {
        isActive: false,
        lastUsedAt: { lt: thirtyDaysAgo }
      }
    });
    
    logger.info(`Session cleanup: Deleted ${result.count} old inactive sessions`);
  } catch (error) {
    logger.error('Session cleanup job failed:', error);
  }
};
