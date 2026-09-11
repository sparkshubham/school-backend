import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { PLANS } from '../config/constants.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, publicUser, authPayload } from '../utils/tokens.js';
import { hashPassword } from '../utils/password.js';
import { flattenInput, toApi, tenantWhere } from '../utils/serialize.js';
import { parsePaging, pageFromRows } from '../utils/paging.js';

const TENANT_KEYS = [
  'name',
  'slug',
  'logo',
  'email',
  'phone',
  'website',
  'address',
  'city',
  'state',
  'pincode',
  'principalName',
  'registrationNo',
  'affiliation',
  'academicSession',
  'status',
  'plan',
  'modules',
  'trialEndsAt',
  'subscriptionEndsAt',
  'branding',
];

function pickTenant(data) {
  const out = {};
  for (const key of TENANT_KEYS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

function slugFromName(name) {
  return String(name || 'school')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'school';
}

async function uniqueSlug(base) {
  let slug = slugFromName(base);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function jsonList(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

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
  const items = await prisma.tenant.findMany({
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
  });
  const statusRows = await prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = { total: 0, active: 0, trial: 0, expired: 0, suspended: 0 };
  for (const row of statusRows) {
    counts[row.status] = row._count?._all ?? 0;
    counts.total += counts[row.status];
  }
  res.json({ ...pageFromRows(toApi(items), page, limit, skip), counts, plans: PLANS });
});

export const createSchool = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (!body.name) throw new AppError('School name is required');
  if (!body.adminEmail || !body.adminPassword) throw new AppError('Admin email and password are required');
  if (!body.slug) body.slug = slugFromName(body.name);
  body.modules = PLANS[body.plan || 'basic']?.modules || PLANS.basic.modules;
  if (body.status === 'trial' && !body.trialEndsAt) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    body.trialEndsAt = d;
  }
  const data = pickTenant(flattenInput(body));
  data.slug = await uniqueSlug(data.slug || body.name);
  if (!data.email) data.email = String(body.adminEmail).toLowerCase().trim();
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
  const admins = await prisma.user.findMany({
    where: { tenantId: school.id, role: 'school_admin' },
    omit: { password: true },
  });
  const branches = await prisma.branch.findMany({ where: { tenantId: school.id } });
  res.json({ school: toApi(school), admins: toApi(admins), branches: toApi(branches), plans: PLANS });
});

export const updateSchool = asyncHandler(async (req, res) => {
  const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('School not found', 404);
  const body = pickTenant(flattenInput(req.body));
  if (req.body.plan && !req.body.modules) body.modules = PLANS[req.body.plan]?.modules;
  if (req.body.slug && req.body.slug !== existing.slug) {
    body.slug = await uniqueSlug(req.body.slug);
  } else {
    delete body.slug;
  }
  const school = await prisma.tenant.update({ where: { id: existing.id }, data: body });
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
  const requested = new Set(
    String(req.query.keys || 'classes,sections,periods,sessions')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const tid = tenantWhere(req, {}).tenantId || null;
  const byTenant = tid ? Prisma.sql`"tenantId" = ${tid}::uuid` : Prisma.sql`TRUE`;
  const byTenantS = tid ? Prisma.sql`s."tenantId" = ${tid}::uuid` : Prisma.sql`TRUE`;
  const [row] = await prisma.$queryRaw`
    SELECT
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT id, name, numeric FROM school_classes
          WHERE ${byTenant}
          ORDER BY "order" ASC NULLS LAST, numeric ASC NULLS LAST
        ) x
      ) AS classes,
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT s.id, s."tenantId", s.name, s.capacity, s."createdAt", s."updatedAt",
                 json_build_object('id', c.id, 'name', c.name) AS class
          FROM sections s
          LEFT JOIN school_classes c ON c.id = s."classId"
          WHERE ${byTenantS}
          ORDER BY s.name ASC
        ) x
      ) AS sections,
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT id, name, code FROM subjects
          WHERE ${byTenant}
          ORDER BY name ASC
        ) x
      ) AS subjects,
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT id, name, "order", "startTime", "endTime", "isBreak" FROM periods
          WHERE ${byTenant}
          ORDER BY "order" ASC NULLS LAST
        ) x
      ) AS periods,
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT id, name, "isCurrent", "startDate", "endDate" FROM academic_sessions
          WHERE ${byTenant}
          ORDER BY "createdAt" DESC
        ) x
      ) AS sessions,
      (
        SELECT COALESCE(json_agg(x), '[]'::json) FROM (
          SELECT id, name, "employeeId", status FROM teachers
          WHERE ${byTenant}
          ORDER BY name ASC
          LIMIT 100
        ) x
      ) AS teachers
  `;
  const pick = (key) => (requested.has(key) ? toApi(jsonList(row?.[key])) : []);
  res.json({
    classes: pick('classes'),
    sections: pick('sections'),
    subjects: pick('subjects'),
    periods: pick('periods'),
    sessions: pick('sessions'),
    teachers: pick('teachers'),
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const school = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  const branches = await prisma.branch.findMany({ where: { tenantId: req.tenantId } });
  res.json({ school: toApi(school), branches: toApi(branches) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const school = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: pickTenant(flattenInput(req.body)),
  });
  res.json(toApi(school));
});
