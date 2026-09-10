import { prisma } from '../config/db.js';
import { PLANS } from '../config/constants.js';
import { asyncHandler } from '../utils/errors.js';
import { toApi } from '../utils/serialize.js';

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
    prisma.tenant.findMany(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.subscriptionPayment.findMany({ where: { status: 'paid' } }),
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
    schools: toApi(schools.slice(-8).reverse()),
    plans: PLANS,
  });
});

export const schoolDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth();

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
    prisma.student.count({ where: { tenantId: tid, status: 'active' } }),
    prisma.teacher.count({ where: { tenantId: tid, status: 'active' } }),
    prisma.schoolClass.count({ where: { tenantId: tid } }),
    prisma.attendanceSheet.findMany({
      where: { tenantId: tid, date: today },
      include: { records: true },
    }),
    prisma.feeInvoice.findMany({ where: { tenantId: tid } }),
    prisma.feePayment.aggregate({
      where: { tenantId: tid, paidAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    }),
    prisma.feePayment.aggregate({
      where: { tenantId: tid, paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.exam.findMany({ where: { tenantId: tid }, orderBy: { startDate: 'desc' }, take: 5 }),
    prisma.calendarEvent.findMany({
      where: { tenantId: tid, startDate: { gte: today } },
      orderBy: { startDate: 'asc' },
      take: 5,
    }),
    prisma.notice.findMany({ where: { tenantId: tid }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.enquiry.findMany({ where: { tenantId: tid }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.homework.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { subject: true, class: true },
    }),
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

  const studentsWithDob = await prisma.student.findMany({
    where: { tenantId: tid, status: 'active', dob: { not: null } },
    take: 500,
  });
  const birthdays = studentsWithDob
    .filter((s) => s.dob.getMonth() === today.getMonth() && s.dob.getDate() === today.getDate())
    .slice(0, 8);

  res.json({
    students,
    teachers,
    classes,
    attendance: { present, absent, leave, taken: todayAttn.length },
    fees: { today: todayPay._sum.amount || 0, month: monthPay._sum.amount || 0, pending: pendingFees },
    exams: toApi(exams),
    events: toApi(events),
    notices: toApi(notices),
    enquiries: toApi(enquiries),
    homework: toApi(homework),
    birthdays: toApi(birthdays),
  });
});

export const teacherDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const teacher = await prisma.teacher.findFirst({
    where: { tenantId: tid, userId: req.user._id },
  });
  const assigned = teacher
    ? await prisma.classSubject.findMany({
        where: { tenantId: tid, teacherId: teacher.id },
        include: { class: true, section: true, subject: true },
      })
    : [];
  const homework = await prisma.homework.findMany({
    where: { tenantId: tid, ...(teacher ? { teacherId: teacher.id } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { class: true, subject: true },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  res.json({
    teacher: toApi(teacher),
    assigned: toApi(assigned),
    homework: toApi(homework),
    notices: toApi(notices),
  });
});

export const parentDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const parent = await prisma.parent.findFirst({
    where: { tenantId: tid, userId: req.user._id },
    include: { students: { include: { class: true, section: true } } },
  });
  const studentIds = parent?.students?.map((s) => s.id) || [];
  const invoices = await prisma.feeInvoice.findMany({
    where: { tenantId: tid, studentId: { in: studentIds } },
    include: { items: true },
  });
  const homework = await prisma.homework.findMany({
    where: { tenantId: tid },
    orderBy: { dueDate: 'asc' },
    take: 8,
    include: { subject: true, class: true },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  const events = await prisma.calendarEvent.findMany({
    where: { tenantId: tid },
    orderBy: { startDate: 'asc' },
    take: 5,
  });
  const exams = await prisma.exam.findMany({
    where: { tenantId: tid },
    orderBy: { startDate: 'desc' },
    take: 4,
  });
  res.json({
    parent: toApi(parent),
    invoices: toApi(invoices),
    homework: toApi(homework),
    notices: toApi(notices),
    events: toApi(events),
    exams: toApi(exams),
  });
});

export const studentDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const student = await prisma.student.findFirst({
    where: { tenantId: tid, userId: req.user._id },
    include: { class: true, section: true },
  });
  if (!student) return res.json({ student: null });
  const homework = await prisma.homework.findMany({
    where: { tenantId: tid, classId: student.classId },
    orderBy: { dueDate: 'asc' },
    take: 8,
    include: { subject: true },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  const invoices = await prisma.feeInvoice.findMany({
    where: { tenantId: tid, studentId: student.id },
    include: { items: true },
  });
  res.json({
    student: toApi(student),
    homework: toApi(homework),
    notices: toApi(notices),
    invoices: toApi(invoices),
  });
});
