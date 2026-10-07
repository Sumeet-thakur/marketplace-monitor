import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { userRepo, sessionRepo } from "./repositories";

const SESSION_COOKIE = "session_id";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = sessionRepo.create(userId, expiresAt);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

export async function destroySession() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    sessionRepo.delete(sessionId);
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = sessionRepo.findWithUser(sessionId);
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  return session.user;
}

export async function createUserIfNoneExist(email: string, password: string) {
  if (userRepo.count() > 0) return null;
  const passwordHash = await hashPassword(password);
  return userRepo.create({ email, passwordHash });
}

export { userRepo };
