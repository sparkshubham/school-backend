import { AppError } from '../utils/errors.js';
import { PLANS } from '../config/constants.js';

export async function attachTenant(req, res, next) {
  try {
    if (req.user?.role === 'super_admin' || !req.tenantId) return next();
    if (req.tenantStatus === 'suspended') throw new AppError('This school account is suspended', 403);
    if (req.tenantStatus === 'expired') throw new AppError('Subscription has expired. Contact support.', 403);
    if (!req.modules?.length) {
      req.modules = PLANS[req.plan]?.modules || PLANS.basic.modules;
    }
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
