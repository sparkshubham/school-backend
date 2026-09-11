import { prisma } from '../config/db.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, verifyRefresh, publicUser, authPayload } from '../utils/tokens.js';
import { comparePassword } from '../utils/password.js';
import { toApi } from '../utils/serialize.js';

const crossSite = Boolean(process.env.VERCEL);
const cookieOpts = {
  httpOnly: true,
  sameSite: crossSite ? 'none' : 'lax',
  secure: crossSite || process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function issueTokens(user, res, school = null) {
  const apiUser = toApi(user);
  const payload = authPayload(apiUser, school);
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
  prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  }).catch(() => {});
  const school = user.tenantId ? await prisma.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const tokens = issueTokens(user, res, school);
  res.json({ ...tokens, school: school ? toApi(school) : null });
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
  const school = user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, plan: true, modules: true },
      })
    : null;
  res.json(issueTokens(user, res, school));
});

export const me = asyncHandler(async (req, res) => {
  let school = null;
  if (req.tenantId) {
    school = toApi(
      await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
          status: true,
          city: true,
          modules: true,
          branding: true,
        },
      })
    );
  }
  res.json({ user: publicUser(req.user), school });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});
