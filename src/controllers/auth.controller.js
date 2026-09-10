import { prisma } from '../config/db.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, verifyRefresh, publicUser } from '../utils/tokens.js';
import { comparePassword } from '../utils/password.js';
import { toApi } from '../utils/serialize.js';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function issueTokens(user, res) {
  const apiUser = toApi(user);
  const payload = { sub: String(apiUser._id), role: apiUser.role, tenantId: apiUser.tenantId || null };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  res.cookie('refreshToken', refreshToken, cookieOpts);
  return { accessToken, refreshToken, user: publicUser(apiUser) };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required');
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (user.status !== 'active') throw new AppError('Account is inactive', 403);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });
  const tokens = issueTokens(updated, res);
  let school = null;
  if (updated.tenantId) school = toApi(await prisma.tenant.findUnique({ where: { id: updated.tenantId } }));
  res.json({ ...tokens, school });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (!token) throw new AppError('Refresh token missing', 401);
  let decoded;
  try {
    decoded = verifyRefresh(token);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || user.status !== 'active') throw new AppError('Account is not active', 401);
  res.json(issueTokens(user, res));
});

export const me = asyncHandler(async (req, res) => {
  let school = null;
  if (req.tenantId) school = toApi(await prisma.tenant.findUnique({ where: { id: req.tenantId } }));
  res.json({ user: publicUser(req.user), school });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});
