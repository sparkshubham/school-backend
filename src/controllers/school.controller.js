import { prisma } from '../config/db.js';
import { PLANS } from '../config/constants.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, publicUser, authPayload } from '../utils/tokens.js';
import { hashPassword } from '../utils/password.js';
import { flattenInput, toApi, tenantWhere } from '../utils/serialize.js';
import { parsePaging, pageResult } from '../utils/paging.js';

export const listSchools = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const where = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (req.query.status) where.status = req.query.status;
  if (req.query.plan) where.plan = req.query.plan;
  const { page, limit, skip } = parsePaging(req);
  const [items, total, statusRows] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.tenant.count({ where }),
    prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts = { total: 0, active: 0, trial: 0, expired: 0, suspended: 0 };
  for (const row of statusRows) {
    counts[row.status] = row._count?._all ?? 0;
    counts.total += counts[row.status];
  }
  res.json({ ...pageResult(toApi(items), total, page, limit), counts, plans: PLANS });
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
  const data = flattenInput(body);
  const school = await prisma.tenant.create({ data });
  await prisma.branch.create({
    data: {
      tenantId: school.id,
      name: 'Main Branch',
      code: 'MAIN',
      isMain: true,
      address: body.address || null,
      phone: body.phone || null,
    },
  });
  if (body.adminEmail && body.adminPassword) {
    await prisma.user.create({
      data: {
        tenantId: school.id,
        name: body.adminName || `${body.name} Admin`,
        email: String(body.adminEmail).toLowerCase().trim(),
        password: await hashPassword(body.adminPassword),
        phone: body.phone || null,
        role: 'school_admin',
      },
    });
  }
  res.status(201).json(toApi(school));
});

export const getSchool = asyncHandler(async (req, res) => {
  const school = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!school) throw new AppError('School not found', 404);
  const [admins, branches] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: school.id, role: 'school_admin' },
      omit: { password: true },
    }),
    prisma.branch.findMany({ where: { tenantId: school.id } }),
  ]);
  res.json({ school: toApi(school), admins: toApi(admins), branches: toApi(branches), plans: PLANS });
});

export const updateSchool = asyncHandler(async (req, res) => {
  const body = flattenInput(req.body);
  if (req.body.plan && !req.body.modules) body.modules = PLANS[req.body.plan]?.modules;
  const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('School not found', 404);
  const school = await prisma.tenant.update({ where: { id: req.params.id }, data: body });
  res.json(toApi(school));
});

export const loginAsAdmin = asyncHandler(async (req, res) => {
  const admin = await prisma.user.findFirst({
    where: { tenantId: req.params.id, role: 'school_admin', status: 'active' },
  });
  if (!admin) throw new AppError('No school admin found', 404);
  const school = await prisma.tenant.findUnique({ where: { id: admin.tenantId } });
  const apiUser = toApi(admin);
  const payload = authPayload(apiUser, school);
  res.json({
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: publicUser(apiUser),
    school: toApi(school),
  });
});

export const getMeta = asyncHandler(async (req, res) => {
  const where = tenantWhere(req, {});
  const requested = new Set(
    String(req.query.keys || 'classes,sections,periods,sessions')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const jobs = [];
  const keys = [];
  const add = (key, promise) => {
    if (!requested.has(key)) return;
    keys.push(key);
    jobs.push(promise);
  };
  add(
    'classes',
    prisma.schoolClass.findMany({
      where,
      orderBy: [{ order: 'asc' }, { numeric: 'asc' }],
      select: { id: true, name: true, numeric: true },
    })
  );
  add(
    'sections',
    prisma.section.findMany({
      where,
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })
  );
  add(
    'subjects',
    prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
  );
  add(
    'periods',
    prisma.period.findMany({
      where,
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, startTime: true, endTime: true, isBreak: true },
    })
  );
  add(
    'sessions',
    prisma.academicSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, isCurrent: true, startDate: true, endDate: true },
    })
  );
  add(
    'teachers',
    prisma.teacher.findMany({
      where,
      select: { id: true, name: true, employeeId: true, status: true },
      orderBy: { name: 'asc' },
      take: 100,
    })
  );
  const values = jobs.length ? await Promise.all(jobs) : [];
  const out = { classes: [], sections: [], subjects: [], periods: [], sessions: [], teachers: [] };
  keys.forEach((key, i) => {
    out[key] = toApi(values[i]);
  });
  res.json(out);
});

export const getProfile = asyncHandler(async (req, res) => {
  const [school, branches] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: req.tenantId } }),
    prisma.branch.findMany({ where: { tenantId: req.tenantId } }),
  ]);
  res.json({ school: toApi(school), branches: toApi(branches) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const school = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: flattenInput(req.body),
  });
  res.json(toApi(school));
});
