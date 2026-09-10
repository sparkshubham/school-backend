import jwt from 'jsonwebtoken';

export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    tenantId: user.tenantId,
    branchId: user.branchId,
    permissions: user.permissions || [],
    linkedStudentId: user.linkedStudentId,
    linkedParentId: user.linkedParentId,
    linkedTeacherId: user.linkedTeacherId,
  };
}

export function authPayload(user, school = null) {
  const id = user._id || user.id;
  return {
    sub: String(id),
    role: user.role,
    tenantId: user.tenantId || null,
    name: user.name,
    email: user.email,
    linkedStudentId: user.linkedStudentId || null,
    linkedParentId: user.linkedParentId || null,
    linkedTeacherId: user.linkedTeacherId || null,
    tenantStatus: school?.status || null,
    plan: school?.plan || null,
    modules: school?.modules || null,
  };
}

export function userFromAccessToken(decoded) {
  return {
    _id: decoded.sub,
    id: decoded.sub,
    role: decoded.role,
    tenantId: decoded.tenantId || null,
    name: decoded.name,
    email: decoded.email,
    permissions: decoded.permissions || [],
    linkedStudentId: decoded.linkedStudentId || null,
    linkedParentId: decoded.linkedParentId || null,
    linkedTeacherId: decoded.linkedTeacherId || null,
  };
}
