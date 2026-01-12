import { prisma } from '../prisma';

// create new session and invalidate all previous sessions for the user
export const createSession = async (userId: number): Promise<string> => {
  const session = await prisma.$transaction(async (tx) => {
    // invalidate all existing active sessions
    await tx.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });
    
    // create new session
    const newSession = await tx.session.create({
      data: { userId, isActive: true }
    });
    
    return newSession;
  });
  
  return session.id;
};

// validate if a session is still active
export const validateSession = async (sessionId: string): Promise<boolean> => {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, isActive: true },
    select: { id: true }
  });
  
  return !!session;
};

// update session last used timestamp
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() }
    });
  } catch {
    // session might not exist
  }
};

// invalidate specific session for logout
export const invalidateSession = async (sessionId: string): Promise<void> => {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false }
    });
  } catch {
    // session might already be deleted
  }
};

// invalidate all sessions for a user like password change or security
export const invalidateAllSessions = async (userId: number): Promise<void> => {
  await prisma.session.updateMany({
    where: { userId },
    data: { isActive: false }
  });
};

