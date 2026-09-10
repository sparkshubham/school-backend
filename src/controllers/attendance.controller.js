import { Attendance } from '../models/Attendance.js';
import { Student } from '../models/Student.js';
import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

export const getSheet = asyncHandler(async (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !date) throw new AppError('classId and date are required');
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const students = await Student.find(
    tenantScope({ classId, ...(sectionId ? { sectionId } : {}), status: 'active' }, req)
  ).sort({ rollNo: 1, firstName: 1 });
  const existing = await Attendance.findOne(
    tenantScope({ classId, ...(sectionId ? { sectionId } : {}), date: { $gte: day, $lt: next } }, req)
  );
  res.json({ students, attendance: existing });
});

export const saveSheet = asyncHandler(async (req, res) => {
  const { classId, sectionId, date, records } = req.body;
  if (!classId || !date || !records) throw new AppError('classId, date and records are required');
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const filter = tenantScope({ classId, date: { $gte: day, $lt: next } }, req);
  if (sectionId) filter.sectionId = sectionId;
  const payload = {
    tenantId: req.tenantId,
    classId,
    sectionId,
    date: day,
    takenBy: req.user._id,
    records,
  };
  const item = await Attendance.findOneAndUpdate(filter, payload, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.json(item);
});

export const reports = asyncHandler(async (req, res) => {
  const { classId, sectionId, from, to, studentId } = req.query;
  const filter = tenantScope({}, req);
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const sheets = await Attendance.find(filter).populate('classId sectionId');
  const byStudent = {};
  sheets.forEach((sheet) => {
    sheet.records.forEach((r) => {
      const id = String(r.studentId);
      if (studentId && id !== studentId) return;
      if (!byStudent[id]) byStudent[id] = { present: 0, absent: 0, late: 0, leave: 0, half_day: 0, total: 0 };
      byStudent[id][r.status] += 1;
      byStudent[id].total += 1;
    });
  });
  const ids = Object.keys(byStudent);
  const students = await Student.find({ _id: { $in: ids } }).populate('classId sectionId');
  const rows = students.map((s) => {
    const stats = byStudent[String(s._id)];
    const pct = stats.total ? Math.round(((stats.present + stats.late + stats.half_day * 0.5) / stats.total) * 1000) / 10 : 0;
    return { student: s, ...stats, percentage: pct, low: pct < 75 };
  });
  res.json({ sheets: sheets.length, rows: rows.sort((a, b) => a.percentage - b.percentage) });
});
