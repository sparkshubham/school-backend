import { prisma } from '../config/db.js';
import { tenantWhere, flattenInput, toApi } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { parsePaging, pageFromRows } from '../utils/paging.js';

const studentInclude = {
  class: { select: { id: true, name: true, numeric: true } },
  section: { select: { id: true, name: true } },
  session: { select: { id: true, name: true } },
  parent: true,
};

const studentListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  admissionNo: true,
  rollNo: true,
  status: true,
  fatherName: true,
  classId: true,
  sectionId: true,
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
};

export const listStudents = asyncHandler(async (req, res) => {
  const where = tenantWhere(req, {});
  if (req.query.status) where.status = req.query.status;
  if (req.query.classId) where.classId = req.query.classId;
  if (req.query.sectionId) where.sectionId = req.query.sectionId;
  const q = (req.query.q || '').trim();
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { admissionNo: { contains: q, mode: 'insensitive' } },
      { rollNo: { contains: q, mode: 'insensitive' } },
    ];
  }
  const { page, limit, skip } = parsePaging(req);
  const items = await prisma.student.findMany({
    where,
    select: studentListSelect,
    orderBy: [{ rollNo: 'asc' }, { firstName: 'asc' }],
    skip,
    take: limit,
  });
  res.json(pageFromRows(toApi(items), page, limit, skip));
});

export const getStudent = asyncHandler(async (req, res) => {
  const item = await prisma.student.findFirst({
    where: tenantWhere(req, { id: req.params.id }),
    include: studentInclude,
  });
  if (!item) throw new AppError('Student not found', 404);
  res.json(toApi(item));
});

export const createStudent = asyncHandler(async (req, res) => {
  const body = flattenInput({ ...req.body, tenantId: req.tenantId });
  delete body.createLogin;
  delete body.parentEmail;
  delete body.parentName;
  delete body.parentPassword;
  delete body.parentPhone;
  let student = await prisma.student.create({ data: body });

  if (req.body.createLogin && req.body.email) {
    const user = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        name: `${req.body.firstName} ${req.body.lastName || ''}`.trim(),
        email: String(req.body.email).toLowerCase().trim(),
        password: await hashPassword(req.body.password || 'Student@123'),
        phone: req.body.phone || null,
        role: 'student',
        linkedStudentId: student.id,
      },
    });
    student = await prisma.student.update({
      where: { id: student.id },
      data: { userId: user.id },
    });
  }

  if (req.body.parentEmail && req.body.parentName) {
    let parent = await prisma.parent.findFirst({
      where: { tenantId: req.tenantId, email: req.body.parentEmail },
    });
    if (!parent) {
      const pUser = await prisma.user.create({
        data: {
          tenantId: req.tenantId,
          name: req.body.parentName,
          email: String(req.body.parentEmail).toLowerCase().trim(),
          password: await hashPassword(req.body.parentPassword || 'Parent@123'),
          phone: req.body.fatherPhone || req.body.parentPhone || null,
          role: 'parent',
        },
      });
      parent = await prisma.parent.create({
        data: {
          tenantId: req.tenantId,
          userId: pUser.id,
          name: req.body.parentName,
          phone: req.body.fatherPhone || null,
          email: req.body.parentEmail,
        },
      });
      await prisma.user.update({
        where: { id: pUser.id },
        data: { linkedParentId: parent.id },
      });
    }
    student = await prisma.student.update({
      where: { id: student.id },
      data: { parentId: parent.id },
    });
  }

  res.status(201).json(toApi(student));
});

export const updateStudent = asyncHandler(async (req, res) => {
  const existing = await prisma.student.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) throw new AppError('Student not found', 404);
  const item = await prisma.student.update({
    where: { id: existing.id },
    data: flattenInput(req.body),
  });
  res.json(toApi(item));
});

export const removeStudent = asyncHandler(async (req, res) => {
  const existing = await prisma.student.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) throw new AppError('Student not found', 404);
  await prisma.student.update({
    where: { id: existing.id },
    data: { status: 'inactive' },
  });
  res.json({ ok: true });
});
