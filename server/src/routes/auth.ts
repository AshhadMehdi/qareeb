import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { runnerProfiles, users } from '../db/schema.js';
import {
  authUser,
  hashPassword,
  issueRefreshToken,
  requireAuth,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, ok, parseBody, unauthorized } from '../lib/errors.js';
import { newId, slugify } from '../lib/ids.js';
import { consumeRateLimit, clearRateLimit } from '../lib/rateLimit.js';
import { loginSchema, passwordSchema, registerSchema } from '../lib/schemas.js';
import { serializeUser } from '../lib/serialize.js';
import { z } from 'zod';

export const authRouter = Router();

function session(user: { id: string; role: string; email: string }, refreshToken: string) {
  return {
    token: signAccessToken({ id: user.id, role: user.role as never, email: user.email }),
    refreshToken,
    expiresInSeconds: env.accessTokenTtlSeconds,
  };
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const db = await getDb();

    const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw conflict('That email is already registered — try signing in');

    const id = newId();
    const { ensureReferralCode, findReferrer } = await import('../lib/referral.js');
    const referrer = input.referralCode && input.role === 'CUSTOMER' ? await findReferrer(input.referralCode) : null;

    await db.insert(users).values({
      id,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      walletPoints: 0,
      referralCode: null,
      referredBy: referrer && referrer.id !== id ? referrer.referralCode : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ensureReferralCode(id);

    if (input.role === 'RIDER') {
      await db.insert(runnerProfiles).values({
        userId: id,
        vehicleType: 'bike',
        isAvailable: false,
        createdAt: new Date().toISOString(),
      });
    }

    const refresh = await issueRefreshToken(id, req.get('user-agent'));
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    res.status(201).json(ok({ user: serializeUser(row!), ...session({ id, role: input.role, email: input.email }, refresh.token) }));
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const limit = await consumeRateLimit(`login:${req.ip}:${input.email}`, 12, 300);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new (await import('../lib/errors.js')).HttpError(429, 'Too many attempts. Try again in a few minutes.');
    }

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }
    if (!user.isActive) throw unauthorized('This account has been disabled. Contact Qareeb support.');

    await clearRateLimit(`login:${req.ip}:${input.email}`);
    const refresh = await issueRefreshToken(user.id, req.get('user-agent'));
    res.json(ok({ user: serializeUser(user), ...session(user, refresh.token) }));
  }),
);

/** One-tap demo sign-in used by the login screen. */
authRouter.post(
  '/demo-login',
  asyncHandler(async (req, res) => {
    const { email } = parseBody(z.object({ email: z.string().min(5).max(160) }), req.body);
    if (!env.autoSeed) throw badRequest('Demo sign-in is disabled on this deployment');
    if (!email.endsWith('@demo.com') && email !== 'admin@qareeb.app') {
      throw badRequest('Demo sign-in only works for the seeded demo accounts');
    }

    const db = await getDb();
    const normalised = email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalised)).limit(1);
    if (!user) throw unauthorized('That demo account is not seeded yet — try again after the first boot');

    const refresh = await issueRefreshToken(user.id, req.get('user-agent'));
    res.json(ok({ user: serializeUser(user), ...session(user, refresh.token) }));
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = parseBody(z.object({ refreshToken: z.string().min(20) }), req.body);
    const rotated = await rotateRefreshToken(refreshToken, req.get('user-agent'));
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, rotated.userId)).limit(1);
    if (!user || !user.isActive) throw unauthorized('Account is no longer available');
    res.json(ok({ user: serializeUser(user), ...session(user, rotated.token) }));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json(ok({ signedOut: true }));
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    res.json(ok({ user: serializeUser(row!) }));
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = authUser(req);
    const input = parseBody(
      z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
      req.body,
    );
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
    if (!row) throw unauthorized();
    if (row.passwordHash && !(await verifyPassword(input.currentPassword, row.passwordHash))) {
      throw badRequest('Your current password is incorrect');
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date().toISOString() })
      .where(eq(users.id, current.id));
    await revokeAllRefreshTokens(current.id);
    res.json(ok({ updated: true }));
  }),
);

/** Optional Google sign-in: verified client-side, exchanged for a Qareeb session. */
authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { idToken } = parseBody(z.object({ idToken: z.string().min(20) }), req.body);
    if (!env.googleClientId) throw badRequest('Google sign-in is not configured on this deployment');

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) throw unauthorized('Google could not verify that sign-in');
    const profile = (await response.json()) as { aud?: string; email?: string; name?: string; picture?: string };
    if (profile.aud !== env.googleClientId || !profile.email) throw unauthorized('Google token mismatch');

    const db = await getDb();
    const email = profile.email.toLowerCase();
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      const id = newId();
      const now = new Date().toISOString();
      await db.insert(users).values({
        id,
        email,
        name: profile.name ?? slugify(email.split('@')[0] ?? 'Qareeb user'),
        role: 'CUSTOMER',
        googleId: profile.picture ?? null,
        avatarUrl: profile.picture ?? null,
        createdAt: now,
        updatedAt: now,
      });
      [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    }
    const refresh = await issueRefreshToken(user!.id, req.get('user-agent'));
    res.json(ok({ user: serializeUser(user!), ...session(user!, refresh.token) }));
  }),
);
