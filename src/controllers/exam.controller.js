import { Exam, ExamSubject, Mark } from '../models/Exam.js';
import { Student } from '../models/Student.js';
import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

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
  const items = await Exam.find(tenantScope({}, req)).sort({ startDate: -1 });
  res.json({ items });
});

export const createExam = asyncHandler(async (req, res) => {
  const exam = await Exam.create({ ...req.body, tenantId: req.tenantId });
  res.status(201).json(exam);
});

export const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOneAndUpdate(tenantScope({ _id: req.params.id }, req), req.body, { new: true });
  if (!exam) throw new AppError('Exam not found', 404);
  res.json(exam);
});

export const addSubject = asyncHandler(async (req, res) => {
  const item = await ExamSubject.create({ ...req.body, tenantId: req.tenantId, examId: req.params.id });
  res.status(201).json(item);
});

export const listSubjects = asyncHandler(async (req, res) => {
  const items = await ExamSubject.find(tenantScope({ examId: req.params.id }, req)).populate('subjectId classId');
  res.json({ items });
});

export const saveMarks = asyncHandler(async (req, res) => {
  const { examSubjectId, entries } = req.body;
  const examSubject = await ExamSubject.findOne(tenantScope({ _id: examSubjectId }, req));
  if (!examSubject) throw new AppError('Exam subject not found', 404);
  const saved = [];
  for (const row of entries) {
    const pct = examSubject.maxMarks ? (row.obtained / examSubject.maxMarks) * 100 : 0;
    const mark = await Mark.findOneAndUpdate(
      { examSubjectId, studentId: row.studentId },
      {
        tenantId: req.tenantId,
        examId: examSubject.examId,
        examSubjectId,
        studentId: row.studentId,
        obtained: row.obtained,
        grade: gradeFor(pct),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved.push(mark);
  }
  res.json({ items: saved });
});

export const results = asyncHandler(async (req, res) => {
  const examId = req.params.id;
  const exam = await Exam.findOne(tenantScope({ _id: examId }, req));
  if (!exam) throw new AppError('Exam not found', 404);
  const subjects = await ExamSubject.find({ examId }).populate('subjectId');
  const marks = await Mark.find({ examId }).populate('studentId');
  const byStudent = {};
  marks.forEach((m) => {
    const sid = String(m.studentId?._id || m.studentId);
    if (!byStudent[sid]) {
      byStudent[sid] = { student: m.studentId, subjects: [], total: 0, max: 0 };
    }
    const sub = subjects.find((s) => String(s._id) === String(m.examSubjectId));
    const max = sub?.maxMarks || 100;
    byStudent[sid].subjects.push({
      name: sub?.subjectId?.name,
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
  res.json({ exam, subjects, rows });
});

export const studentResult = asyncHandler(async (req, res) => {
  const { examId, studentId } = req.params;
  const exam = await Exam.findOne(tenantScope({ _id: examId }, req));
  const student = await Student.findOne(tenantScope({ _id: studentId }, req)).populate('classId sectionId');
  const subjects = await ExamSubject.find({ examId }).populate('subjectId');
  const marks = await Mark.find({ examId, studentId });
  const rows = subjects.map((sub) => {
    const m = marks.find((x) => String(x.examSubjectId) === String(sub._id));
    return {
      name: sub.subjectId?.name,
      max: sub.maxMarks,
      obtained: m?.obtained ?? null,
      grade: m?.grade ?? null,
    };
  });
  const total = rows.reduce((s, r) => s + (r.obtained || 0), 0);
  const max = rows.reduce((s, r) => s + (r.max || 0), 0);
  const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
  res.json({
    exam,
    student,
    rows,
    total,
    max,
    percentage,
    grade: gradeFor(percentage),
    result: percentage >= 33 ? 'PASS' : 'FAIL',
  });
});
