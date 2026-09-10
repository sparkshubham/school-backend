import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { PLANS } from '../config/constants.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, publicUser } from '../utils/tokens.js';

export const listSchools = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { city: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
  if (req.query.status) filter.status = req.query.status;
  if (req.query.plan) filter.plan = req.query.plan;
  const items = await Tenant.find(filter).sort({ createdAt: -1 });
  res.json({ items, total: items.length, plans: PLANS });
});

export const createSchool = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (!body.slug && body.name) {
    body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  body.modules = PLANS[body.plan || 'basic']?.modules || PLANS.basic.modules;
  if (body.status === 'trial' && !body.trialEndsAt) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    body.trialEndsAt = d;
  }
  const school = await Tenant.create(body);
  await Branch.create({
    tenantId: school._id,
    name: 'Main Branch',
    code: 'MAIN',
    isMain: true,
    address: body.address,
    phone: body.phone,
  });
  if (body.adminEmail && body.adminPassword) {
    await User.create({
      tenantId: school._id,
      name: body.adminName || `${body.name} Admin`,
      email: body.adminEmail,
      password: body.adminPassword,
      phone: body.phone,
      role: 'school_admin',
    });
  }
  res.status(201).json(school);
});

export const getSchool = asyncHandler(async (req, res) => {
  const school = await Tenant.findById(req.params.id);
  if (!school) throw new AppError('School not found', 404);
  const [admins, branches] = await Promise.all([
    User.find({ tenantId: school._id, role: 'school_admin' }).select('-password'),
    Branch.find({ tenantId: school._id }),
  ]);
  res.json({ school, admins, branches, plans: PLANS });
});

export const updateSchool = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.plan && !body.modules) body.modules = PLANS[body.plan]?.modules;
  const school = await Tenant.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!school) throw new AppError('School not found', 404);
  res.json(school);
});

export const loginAsAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ tenantId: req.params.id, role: 'school_admin', status: 'active' });
  if (!admin) throw new AppError('No school admin found', 404);
  const payload = { sub: String(admin._id), role: admin.role, tenantId: admin.tenantId };
  res.json({
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: publicUser(admin),
    school: await Tenant.findById(admin.tenantId),
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const school = await Tenant.findById(req.tenantId);
  const branches = await Branch.find({ tenantId: req.tenantId });
  res.json({ school, branches });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const school = await Tenant.findByIdAndUpdate(req.tenantId, req.body, { new: true });
  res.json(school);
});
