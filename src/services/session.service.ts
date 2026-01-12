import { prisma } from '../prisma';

/**
 * Create new session and invalidate all previous sessions for the user
 * This enforces single active session policy
 */
export const createSession = async (userId: number): Promise<string> => {
  // Use transaction to ensure atomicity
  const session = await prisma.$transaction(async (tx) => {
    // Step 1: Invalidate all existing active sessions
    await tx.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });
    
    // Step 2: Create new session
    const newSession = await tx.session.create({
      data: { userId, isActive: true }
    });
    
    return newSession;
  });
  
  return session.id;
};

/**
 * Validate if a session is still active
 * Uses indexed query for fast lookup
 */
export const validateSession = async (sessionId: string): Promise<boolean> => {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, isActive: true },
    select: { id: true }
  });
  
  return !!session;
};

/**
 * Update session last used timestamp
 * Called on every authenticated request
 */
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
  } catch (error) {
    // Session might not exist or be deleted, ignore error
  }
};

/**
 * Invalidate specific session (logout)
 */
export const invalidateSession = async (sessionId: string): Promise<void> => {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false }
    });
  } catch (error) {
    // Session might already be deleted, ignore error
  }
};

/**
 * Invalidate all sessions for a user (password change, security)
 */
export const invalidateAllSessions = async (userId: number): Promise<void> => {
  await prisma.session.updateMany({
    where: { userId },
    data: { isActive: false }
  });
};
