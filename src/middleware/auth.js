import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { verifyAccess } from '../utils/tokens.js';
import { toApi } from '../utils/serialize.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
    if (!token) throw new AppError('Authentication required', 401);
    const decoded = verifyAccess(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      omit: { password: true },
    });
    if (!user || user.status !== 'active') throw new AppError('Account is not active', 401);
    req.user = toApi(user);
    req.tenantId = user.tenantId || null;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401));
    }
    next(err);
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission for this action', 403));
    }
    next();
  };
}

export function tenantScope(query, req) {
  if (req.user?.role === 'super_admin' && req.query.tenantId) {
    query.tenantId = req.query.tenantId;
    return query;
  }
  if (req.user?.role !== 'super_admin') {
    query.tenantId = req.tenantId;
  }
  return query;
}
