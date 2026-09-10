import { prisma } from '../config/db.js';
import { tenantWhere, flattenInput, toApi } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { parsePaging, pageFromRows, pageResult } from '../utils/paging.js';

function gradeFor(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

export const listExams = asyncHandler(async (req, res) => {
  const where = tenantWhere(req, {});
  const { page, limit, skip } = parsePaging(req);
  const items = await prisma.exam.findMany({
    where,
    orderBy: { startDate: 'desc' },
    skip,
    take: limit,
    select: { id: true, name: true, type: true, status: true, startDate: true, endDate: true },
  });
  res.json(pageFromRows(toApi(items), page, limit, skip));
});

export const createExam = asyncHandler(async (req, res) => {
  const exam = await prisma.exam.create({
    data: { ...flattenInput(req.body), tenantId: req.tenantId },
  });
  res.status(201).json(toApi(exam));
});

export const updateExam = asyncHandler(async (req, res) => {
  const existing = await prisma.exam.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) throw new AppError('Exam not found', 404);
  const exam = await prisma.exam.update({
    where: { id: existing.id },
    data: flattenInput(req.body),
  });
  res.json(toApi(exam));
});

export const addSubject = asyncHandler(async (req, res) => {
  const item = await prisma.examSubject.create({
    data: { ...flattenInput(req.body), tenantId: req.tenantId, examId: req.params.id },
  });
  res.status(201).json(toApi(item));
});

export const listSubjects = asyncHandler(async (req, res) => {
  const items = await prisma.examSubject.findMany({
    where: tenantWhere(req, { examId: req.params.id }),
    include: { subject: true, class: true },
  });
  res.json({ items: toApi(items) });
});

export const saveMarks = asyncHandler(async (req, res) => {
  const { examSubjectId, entries } = req.body;
  const examSubject = await prisma.examSubject.findFirst({
    where: tenantWhere(req, { id: examSubjectId }),
  });
  if (!examSubject) throw new AppError('Exam subject not found', 404);
  const saved = [];
  for (const row of entries) {
    const pct = examSubject.maxMarks ? (row.obtained / examSubject.maxMarks) * 100 : 0;
    const mark = await prisma.mark.upsert({
      where: {
        examSubjectId_studentId: { examSubjectId, studentId: row.studentId },
      },
      update: {
        obtained: row.obtained,
        grade: gradeFor(pct),
      },
      create: {
        tenantId: req.tenantId,
        examId: examSubject.examId,
        examSubjectId,
        studentId: row.studentId,
        obtained: row.obtained,
        grade: gradeFor(pct),
      },
    });
    saved.push(mark);
  }
  res.json({ items: toApi(saved) });
});

export const results = asyncHandler(async (req, res) => {
  const examId = req.params.id;
  const exam = await prisma.exam.findFirst({ where: tenantWhere(req, { id: examId }) });
  if (!exam) throw new AppError('Exam not found', 404);
  const subjects = await prisma.examSubject.findMany({
    where: { examId },
    include: { subject: true },
  });
  const marks = await prisma.mark.findMany({
    where: { examId },
    include: { student: { select: { id: true, firstName: true, lastName: true, rollNo: true } } },
  });
  const byStudent = {};
  marks.forEach((m) => {
    const sid = String(m.student?.id || m.studentId);
    if (!byStudent[sid]) {
      byStudent[sid] = { student: toApi(m.student), subjects: [], total: 0, max: 0 };
    }
    const sub = subjects.find((s) => String(s.id) === String(m.examSubjectId));
    const max = sub?.maxMarks || 100;
    byStudent[sid].subjects.push({
      name: sub?.subject?.name,
      obtained: m.obtained,
      max,
      grade: m.grade,
    });
    byStudent[sid].total += m.obtained;
    byStudent[sid].max += max;
  });
  const rows = Object.values(byStudent)
    .map((r) => {
      const percentage = r.max ? Math.round((r.total / r.max) * 1000) / 10 : 0;
      return {
        ...r,
        percentage,
        grade: gradeFor(percentage),
        result: percentage >= 33 ? 'PASS' : 'FAIL',
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const { page, limit, skip } = parsePaging(req);
  res.json({
    exam: toApi(exam),
    subjects: toApi(subjects),
    ...pageResult(rows.slice(skip, skip + limit), rows.length, page, limit),
    rows: rows.slice(skip, skip + limit),
  });
});

export const studentResult = asyncHandler(async (req, res) => {
  const { examId, studentId } = req.params;
  const exam = await prisma.exam.findFirst({ where: tenantWhere(req, { id: examId }) });
  const student = await prisma.student.findFirst({
    where: tenantWhere(req, { id: studentId }),
    include: { class: true, section: true },
  });
  const subjects = await prisma.examSubject.findMany({
    where: { examId },
    include: { subject: true },
  });
  const marks = await prisma.mark.findMany({ where: { examId, studentId } });
  const rows = subjects.map((sub) => {
    const m = marks.find((x) => String(x.examSubjectId) === String(sub.id));
    return {
      name: sub.subject?.name,
      max: sub.maxMarks,
      obtained: m?.obtained ?? null,
      grade: m?.grade ?? null,
    };
  });
  const total = rows.reduce((s, r) => s + (r.obtained || 0), 0);
  const max = rows.reduce((s, r) => s + (r.max || 0), 0);
  const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
  res.json({
    exam: toApi(exam),
    student: toApi(student),
    rows,
    total,
    max,
    percentage,
    grade: gradeFor(percentage),
    result: percentage >= 33 ? 'PASS' : 'FAIL',
  });
});
