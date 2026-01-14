import { prisma } from '../prisma';
import { redis } from '../config/redis.config';

const SESSION_KEY = 'session:';
const SESSION_TTL = 604800; // 7 days in seconds exact as refresh token

// create new session and invalidate all previous sessions for the user
export const createSession = async (userId: number): Promise<string> => {
  // find old sessions to clear from cache
  const oldSessions = await prisma.session.findMany({
    where: { userId, isActive: true },
    select: { id: true }
  });

  // clear old sessions from redis
  for (const s of oldSessions) {
    await redis.del(SESSION_KEY + s.id);
  }

  const session = await prisma.$transaction(async (tx) => {
    // invalidate all existing active sessions in db
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

  // cache the new session
  await redis.set(SESSION_KEY + session.id, '1', 'EX', SESSION_TTL);
  
  return session.id;
};

// validate if a session is still active
// checks redis first then db as fallback
export const validateSession = async (sessionId: string): Promise<boolean> => {
  // check redis cache first
  const cached = await redis.get(SESSION_KEY + sessionId);
  if (cached) {
    return true;
  }

  // fallback to db
  const session = await prisma.session.findFirst({
    where: { id: sessionId, isActive: true },
    select: { id: true }
  });
  
  if (session) {
    // cache it for next time
    await redis.set(SESSION_KEY + sessionId, '1', 'EX', SESSION_TTL);
    return true;
  }

  return false;
};

// update session last used timestamp
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  try {
    // extend redis ttl
    await redis.expire(SESSION_KEY + sessionId, SESSION_TTL);
  } catch {
    // ignore errors
  }
};

// invalidate specific session for logout
export const invalidateSession = async (sessionId: string): Promise<void> => {
  // clear from redis first
  await redis.del(SESSION_KEY + sessionId);
  
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
  // find all sessions to clear from cache
  const sessions = await prisma.session.findMany({
    where: { userId, isActive: true },
    select: { id: true }
  });

  // clear from redis
  for (const s of sessions) {
    await redis.del(SESSION_KEY + s.id);
  }

  // clear from db
  await prisma.session.updateMany({
    where: { userId },
    data: { isActive: false }
  });
};


