import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { PLANS } from '../config/constants.js';
import { toApi } from '../utils/serialize.js';

export async function attachTenant(req, res, next) {
  try {
    if (req.user?.role === 'super_admin' || !req.tenantId) return next();
    if (req.tenantStatus) {
      if (req.tenantStatus === 'suspended') throw new AppError('This school account is suspended', 403);
      if (req.tenantStatus === 'expired') throw new AppError('Subscription has expired. Contact support.', 403);
      if (!req.modules?.length) {
        req.modules = PLANS[req.plan]?.modules || PLANS.basic.modules;
      }
      return next();
    }
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, status: true, plan: true, modules: true, name: true },
    });
    if (!tenant) throw new AppError('School not found', 404);
    if (tenant.status === 'suspended') throw new AppError('This school account is suspended', 403);
    if (tenant.status === 'expired') throw new AppError('Subscription has expired. Contact support.', 403);
    req.tenant = toApi(tenant);
    req.modules = tenant.modules?.length
      ? tenant.modules
      : PLANS[tenant.plan]?.modules || PLANS.basic.modules;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireModule(moduleKey) {
  return (req, res, next) => {
    if (req.user?.role === 'super_admin') return next();
    if (!req.modules || req.modules.includes(moduleKey)) return next();
    next(new AppError(`Your plan does not include ${moduleKey}. Upgrade to unlock it.`, 403));
  };
}
