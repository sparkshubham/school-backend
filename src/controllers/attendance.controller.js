import { prisma } from '../config/db.js';
import { tenantWhere, toApi, dateOnly } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';

export const getSheet = asyncHandler(async (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !date) throw new AppError('classId and date are required');
  const day = dateOnly(date);
  const studentWhere = tenantWhere(req, { classId, ...(sectionId ? { sectionId } : {}), status: 'active' });
  const [students, existing] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      orderBy: [{ rollNo: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, rollNo: true, admissionNo: true },
    }),
    prisma.attendanceSheet.findFirst({
      where: tenantWhere(req, { classId, ...(sectionId ? { sectionId } : {}), date: day }),
      include: { records: { select: { id: true, studentId: true, status: true } } },
    }),
  ]);
  res.json({ students: toApi(students), attendance: toApi(existing) });
});

export const saveSheet = asyncHandler(async (req, res) => {
  const { classId, sectionId, date, records } = req.body;
  if (!classId || !date || !records) throw new AppError('classId, date and records are required');
  const day = dateOnly(date);
  const filter = tenantWhere(req, { classId, date: day });
  if (sectionId) filter.sectionId = sectionId;
  const existing = await prisma.attendanceSheet.findFirst({ where: filter });
  const recordCreate = (records || []).map((r) => ({
    studentId: r.studentId?._id || r.studentId,
    status: r.status,
  }));

  let item;
  if (existing) {
    item = await prisma.attendanceSheet.update({
      where: { id: existing.id },
      data: {
        takenBy: req.user._id,
        records: {
          deleteMany: {},
          create: recordCreate,
        },
      },
      include: { records: true },
    });
  } else {
    item = await prisma.attendanceSheet.create({
      data: {
        tenantId: req.tenantId,
        classId,
        sectionId: sectionId || null,
        date: day,
        takenBy: req.user._id,
        records: { create: recordCreate },
      },
      include: { records: true },
    });
  }
  res.json(toApi(item));
});

export const reports = asyncHandler(async (req, res) => {
  const { classId, sectionId, from, to, studentId } = req.query;
  const filter = tenantWhere(req, {});
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.gte = dateOnly(from);
    if (to) filter.date.lte = dateOnly(to);
  } else {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    filter.date = { gte: dateOnly(start), lte: dateOnly(end) };
  }

  const grouped = await prisma.attendanceRecord.groupBy({
    by: ['studentId', 'status'],
    where: {
      sheet: filter,
      ...(studentId ? { studentId } : {}),
    },
    _count: { _all: true },
  });

  const byStudent = {};
  grouped.forEach((row) => {
    const id = String(row.studentId);
    if (!byStudent[id]) byStudent[id] = { present: 0, absent: 0, late: 0, leave: 0, half_day: 0, total: 0 };
    byStudent[id][row.status] += row._count._all;
    byStudent[id].total += row._count._all;
  });

  const ids = Object.keys(byStudent);
  const students = ids.length
    ? await prisma.student.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rollNo: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      })
    : [];

  const rows = students.map((s) => {
    const stats = byStudent[String(s.id)];
    const pct = stats.total
      ? Math.round(((stats.present + stats.late + stats.half_day * 0.5) / stats.total) * 1000) / 10
      : 0;
    return { student: toApi(s), ...stats, percentage: pct, low: pct < 75 };
  });
  res.json({ sheets: grouped.length, rows: rows.sort((a, b) => a.percentage - b.percentage) });
});
