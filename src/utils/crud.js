import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

export function createCrud(Model, options = {}) {
  const {
    populate = [],
    searchFields = ['name'],
    extraFilter,
  } = options;

  const applyPop = (q) => {
    populate.forEach((p) => {
      q = typeof p === 'string' ? q.populate(p) : q.populate(p);
    });
    return q;
  };

  return {
    list: asyncHandler(async (req, res) => {
      const filter = tenantScope({}, req);
      if (extraFilter) Object.assign(filter, extraFilter(req));
      const q = (req.query.q || '').trim();
      if (q && searchFields.length) {
        filter.$or = searchFields.map((f) => ({ [f]: new RegExp(q, 'i') }));
      }
      if (req.query.status) filter.status = req.query.status;
      if (req.query.classId) filter.classId = req.query.classId;
      if (req.query.sectionId) filter.sectionId = req.query.sectionId;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const [items, total] = await Promise.all([
        applyPop(Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
        Model.countDocuments(filter),
      ]);
      res.json({ items, total, page, pages: Math.ceil(total / limit) });
    }),

    get: asyncHandler(async (req, res) => {
      const filter = tenantScope({ _id: req.params.id }, req);
      const item = await applyPop(Model.findOne(filter));
      if (!item) throw new AppError('Not found', 404);
      res.json(item);
    }),

    create: asyncHandler(async (req, res) => {
      const body = { ...req.body };
      if (req.user.role !== 'super_admin') body.tenantId = req.tenantId;
      if (!body.userId && Model.modelName === 'LeaveRequest') {
        body.userId = req.user._id;
        body.role = req.user.role;
      }
      const item = await Model.create(body);
      res.status(201).json(item);
    }),

    update: asyncHandler(async (req, res) => {
      const filter = tenantScope({ _id: req.params.id }, req);
      const item = await Model.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
      if (!item) throw new AppError('Not found', 404);
      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      const filter = tenantScope({ _id: req.params.id }, req);
      const item = await Model.findOneAndDelete(filter);
      if (!item) throw new AppError('Not found', 404);
      res.json({ ok: true });
    }),
  };
}

export function mountCrud(router, handlers, { adminOnly = false } = {}) {
  router.get('/', handlers.list);
  router.get('/:id', handlers.get);
  router.post('/', handlers.create);
  router.patch('/:id', handlers.update);
  router.delete('/:id', handlers.remove);
  return router;
}
