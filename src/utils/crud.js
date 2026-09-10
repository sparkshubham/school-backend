import { prisma } from '../config/db.js';
import { tenantWhere, flattenInput, toApi } from './serialize.js';
import { asyncHandler, AppError } from './errors.js';
import { hashPassword } from './password.js';
import { parsePaging, pageResult } from './paging.js';

const NESTED_LISTS = {
  transportRoute: {
    field: 'stops',
    create: (stops) => ({
      create: (stops || []).map((s, i) => ({
        name: s.name,
        order: s.order ?? i + 1,
        pickupTime: s.pickupTime || null,
      })),
    }),
  },
};

export function createCrud(model, options = {}) {
  const {
    searchFields = ['name'],
    include,
    extraFilter,
  } = options;
  const db = prisma[model];

  function whereFromReq(req, extra = {}) {
    const where = tenantWhere(req, extra);
    if (extraFilter) Object.assign(where, extraFilter(req));
    const q = (req.query.q || '').trim();
    if (q && searchFields.length) {
      where.OR = searchFields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.classId) where.classId = req.query.classId;
    if (req.query.sectionId) where.sectionId = req.query.sectionId;
    return where;
  }

  function findArgs(where) {
    const args = { where };
    if (include) args.include = include;
    if (model === 'user') args.omit = { password: true };
    return args;
  }

  async function prepareData(req, forUpdate = false) {
    const data = flattenInput(req.body);
    if (!forUpdate && req.user.role !== 'super_admin') data.tenantId = req.tenantId;
    if (model === 'leaveRequest' && !data.userId) {
      data.userId = req.user._id || req.user.id;
      data.role = req.user.role;
    }
    if (model === 'user' && req.body.password) {
      data.password = await hashPassword(req.body.password);
    } else {
      delete data.password;
    }

    const nested = NESTED_LISTS[model];
    if (nested && Array.isArray(data[nested.field])) {
      const list = data[nested.field];
      delete data[nested.field];
      if (forUpdate) {
        data[nested.field] = { deleteMany: {}, ...nested.create(list) };
      } else {
        data[nested.field] = nested.create(list);
      }
    }
    return data;
  }

  return {
    list: asyncHandler(async (req, res) => {
      const where = whereFromReq(req);
      const { page, limit, skip } = parsePaging(req);
      const [items, total] = await Promise.all([
        db.findMany({
          ...findArgs(where),
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.count({ where }),
      ]);
      res.json(pageResult(toApi(items), total, page, limit));
    }),

    get: asyncHandler(async (req, res) => {
      const item = await db.findFirst(findArgs(whereFromReq(req, { id: req.params.id })));
      if (!item) throw new AppError('Not found', 404);
      res.json(toApi(item));
    }),

    create: asyncHandler(async (req, res) => {
      const data = await prepareData(req, false);
      const item = await db.create({ data, ...(include ? { include } : {}), ...(model === 'user' ? { omit: { password: true } } : {}) });
      res.status(201).json(toApi(item));
    }),

    update: asyncHandler(async (req, res) => {
      const existing = await db.findFirst({ where: whereFromReq(req, { id: req.params.id }) });
      if (!existing) throw new AppError('Not found', 404);
      const data = await prepareData(req, true);
      delete data.tenantId;
      const item = await db.update({
        where: { id: existing.id },
        data,
        ...(include ? { include } : {}),
        ...(model === 'user' ? { omit: { password: true } } : {}),
      });
      res.json(toApi(item));
    }),

    remove: asyncHandler(async (req, res) => {
      const existing = await db.findFirst({ where: whereFromReq(req, { id: req.params.id }) });
      if (!existing) throw new AppError('Not found', 404);
      await db.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    }),
  };
}

export function mountCrud(router, handlers) {
  router.get('/', handlers.list);
  router.get('/:id', handlers.get);
  router.post('/', handlers.create);
  router.patch('/:id', handlers.update);
  router.delete('/:id', handlers.remove);
  return router;
}
