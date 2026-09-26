import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { refreshTokens, users, type UserRole } from '../db/schema.js';
import { forbidden, unauthorized } from './errors.js';
import { newId } from './ids.js';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  walletPoints: number;
  avatarUrl: string | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

type TokenPayload = { sub: string; role: UserRole; email: string };

export function signAccessToken(user: Pick<AuthUser, 'id' | 'role' | 'email'>): string {
  const payload: TokenPayload = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'string') return null;
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Issues a rotating refresh token; only its hash is persisted. */
export async function issueRefreshToken(userId: string, userAgent?: string | null) {
  const db = await getDb();
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 86_400_000);
  await db.insert(refreshTokens).values({
    id: newId(),
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 200) ?? null,
    expiresAt: expiresAt.toISOString(),
  });
  return { token, expiresAt };
}

export async function rotateRefreshToken(token: string, userAgent?: string | null) {
  const db = await getDb();
  const hash = hashToken(token);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  if (!row) throw unauthorized('Session expired, please sign in again');

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.id, row.id));

  const next = await issueRefreshToken(row.userId, userAgent);
  return { userId: row.userId, ...next };
}

export async function revokeRefreshToken(token: string) {
  const db = await getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)));
}

export async function revokeAllRefreshTokens(userId: string) {
  const db = await getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.userId, userId));
}

function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function loadUser(userId: string): Promise<AuthUser | null> {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    walletPoints: row.walletPoints,
    avatarUrl: row.avatarUrl,
  };
}

/** Attaches req.user when a valid bearer token is present, otherwise no-op. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      const user = await loadUser(payload.sub);
      if (user) req.user = user;
    }
  }
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return next(unauthorized());
  const payload = verifyAccessToken(token);
  if (!payload) return next(unauthorized('Your session expired, please sign in again'));
  const user = await loadUser(payload.sub);
  if (!user) return next(unauthorized('Account is disabled or no longer exists'));
  req.user = user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(forbidden(`This area is for ${roles.join(' / ').toLowerCase()} accounts`));
    }
    next();
  };
}

export function authUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
