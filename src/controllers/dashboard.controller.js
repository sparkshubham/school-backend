import { Parent } from '../models/Parent.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { Attendance } from '../models/Attendance.js';
import { FeeInvoice, FeePayment } from '../models/Fee.js';
import { Enquiry, Event, Notice } from '../models/Ops.js';
import { Exam } from '../models/Exam.js';
import { Homework } from '../models/Homework.js';
import { SubscriptionPayment } from '../models/Subscription.js';
import { PLANS } from '../config/constants.js';
import { asyncHandler } from '../utils/errors.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const superDashboard = asyncHandler(async (req, res) => {
  const [schools, students, teachers, payments] = await Promise.all([
    Tenant.find(),
    Student.countDocuments(),
    Teacher.countDocuments(),
    SubscriptionPayment.find({ status: 'paid' }),
  ]);
  const now = new Date();
  const counts = {
    totalSchools: schools.length,
    active: schools.filter((s) => s.status === 'active').length,
    trial: schools.filter((s) => s.status === 'trial').length,
    expired: schools.filter((s) => s.status === 'expired').length,
    totalStudents: students,
    totalTeachers: teachers,
  };
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthlyRevenue = payments
    .filter((p) => p.paidAt && p.paidAt.getFullYear() === year && p.paidAt.getMonth() === month)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const annualRevenue = payments
    .filter((p) => p.paidAt && p.paidAt.getFullYear() === year)
    .reduce((s, p) => s + (p.amount || 0), 0);
  res.json({
    ...counts,
    monthlyRevenue,
    annualRevenue,
    newSchools: schools.filter((s) => s.createdAt >= startOfMonth()).length,
    pendingPayments: schools.filter((s) => s.status === 'trial' || s.status === 'expired').length,
    schools: schools.slice(-8).reverse(),
    plans: PLANS,
  });
});

export const schoolDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth();
  const { SchoolClass } = await import('../models/SchoolClass.js');

  const [
    students,
    teachers,
    classes,
    todayAttn,
    invoices,
    todayPay,
    monthPay,
    exams,
    events,
    notices,
    enquiries,
    homework,
  ] = await Promise.all([
    Student.countDocuments({ tenantId: tid, status: 'active' }),
    Teacher.countDocuments({ tenantId: tid, status: 'active' }),
    SchoolClass.countDocuments({ tenantId: tid }),
    Attendance.find({ tenantId: tid, date: { $gte: today, $lt: tomorrow } }),
    FeeInvoice.find({ tenantId: tid }),
    FeePayment.aggregate([
      { $match: { tenantId: tid, paidAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    FeePayment.aggregate([
      { $match: { tenantId: tid, paidAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Exam.find({ tenantId: tid }).sort({ startDate: -1 }).limit(5),
    Event.find({ tenantId: tid, startDate: { $gte: today } }).sort({ startDate: 1 }).limit(5),
    Notice.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(6),
    Enquiry.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(6),
    Homework.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(5).populate('subjectId classId'),
  ]);

  let present = 0;
  let absent = 0;
  let leave = 0;
  todayAttn.forEach((a) => {
    a.records.forEach((r) => {
      if (r.status === 'present' || r.status === 'late') present += 1;
      else if (r.status === 'leave') leave += 1;
      else absent += 1;
    });
  });

  const pendingFees = invoices.reduce((s, i) => s + (i.due || 0), 0);

  const birthdays = await Student.find({
    tenantId: tid,
    status: 'active',
    $expr: {
      $and: [
        { $eq: [{ $month: '$dob' }, today.getMonth() + 1] },
        { $eq: [{ $dayOfMonth: '$dob' }, today.getDate()] },
      ],
    },
  }).limit(8);

  res.json({
    students,
    teachers,
    classes,
    attendance: { present, absent, leave, taken: todayAttn.length },
    fees: { today: todayPay[0]?.total || 0, month: monthPay[0]?.total || 0, pending: pendingFees },
    exams,
    events,
    notices,
    enquiries,
    homework,
    birthdays,
  });
});

export const teacherDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const teacher = await Teacher.findOne({ tenantId: tid, userId: req.user._id });
  const { ClassSubject } = await import('../models/ClassSubject.js');
  const assigned = teacher
    ? await ClassSubject.find({ tenantId: tid, teacherId: teacher._id }).populate('classId sectionId subjectId')
    : [];
  const homework = await Homework.find({ tenantId: tid, ...(teacher ? { teacherId: teacher._id } : {}) })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('classId subjectId');
  const notices = await Notice.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(5);
  res.json({ teacher, assigned, homework, notices });
});

export const parentDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const parent = await Parent.findOne({ tenantId: tid, userId: req.user._id }).populate({
    path: 'students',
    populate: { path: 'classId sectionId' },
  });
  const studentIds = parent?.students?.map((s) => s._id) || [];
  const invoices = await FeeInvoice.find({ tenantId: tid, studentId: { $in: studentIds } });
  const homework = await Homework.find({ tenantId: tid }).sort({ dueDate: 1 }).limit(8).populate('subjectId classId');
  const notices = await Notice.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(6);
  const events = await Event.find({ tenantId: tid }).sort({ startDate: 1 }).limit(5);
  const exams = await Exam.find({ tenantId: tid }).sort({ startDate: -1 }).limit(4);
  res.json({ parent, invoices, homework, notices, events, exams });
});

export const studentDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const student = await Student.findOne({ tenantId: tid, userId: req.user._id }).populate('classId sectionId');
  if (!student) return res.json({ student: null });
  const homework = await Homework.find({
    tenantId: tid,
    classId: student.classId,
  })
    .sort({ dueDate: 1 })
    .limit(8)
    .populate('subjectId');
  const notices = await Notice.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(6);
  const invoices = await FeeInvoice.find({ tenantId: tid, studentId: student._id });
  res.json({ student, homework, notices, invoices });
});
