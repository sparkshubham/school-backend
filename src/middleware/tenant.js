import { Tenant } from '../models/Tenant.js';
import { AppError } from '../utils/errors.js';
import { PLANS } from '../config/constants.js';

export async function attachTenant(req, res, next) {
  try {
    if (req.user?.role === 'super_admin' || !req.tenantId) return next();
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) throw new AppError('School not found', 404);
    if (tenant.status === 'suspended') throw new AppError('This school account is suspended', 403);
    if (tenant.status === 'expired') throw new AppError('Subscription has expired. Contact support.', 403);
    req.tenant = tenant;
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
