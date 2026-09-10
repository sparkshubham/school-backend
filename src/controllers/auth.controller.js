import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, verifyRefresh, publicUser } from '../utils/tokens.js';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function issueTokens(user, res) {
  const payload = { sub: String(user._id), role: user.role, tenantId: user.tenantId || null };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  res.cookie('refreshToken', refreshToken, cookieOpts);
  return { accessToken, refreshToken, user: publicUser(user) };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (user.status !== 'active') throw new AppError('Account is inactive', 403);
  user.lastLogin = new Date();
  await user.save();
  const tokens = issueTokens(user, res);
  let school = null;
  if (user.tenantId) school = await Tenant.findById(user.tenantId);
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
  const user = await User.findById(decoded.sub);
  if (!user || user.status !== 'active') throw new AppError('Account is not active', 401);
  res.json(issueTokens(user, res));
});

export const me = asyncHandler(async (req, res) => {
  let school = null;
  if (req.tenantId) school = await Tenant.findById(req.tenantId);
  res.json({ user: publicUser(req.user), school });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});
