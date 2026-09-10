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

function countByStatus(rows) {
  const map = {};
  for (const row of rows) map[row.status] = row._count?._all ?? row._count ?? 0;
  return map;
}

export const superDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [statusRows, students, teachers, monthly, annual, newSchools, pendingPayments, schools] =
    await Promise.all([
      prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.subscriptionPayment.aggregate({
        where: { status: 'paid', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.aggregate({
        where: { status: 'paid', paidAt: { gte: yearStart } },
        _sum: { amount: true },
      }),
      prisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.tenant.count({ where: { status: { in: ['trial', 'expired'] } } }),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, name: true, city: true, plan: true, status: true, createdAt: true },
      }),
    ]);

  const byStatus = countByStatus(statusRows);
  const totalSchools = Object.values(byStatus).reduce((s, n) => s + n, 0);

  res.json({
    totalSchools,
    active: byStatus.active || 0,
    trial: byStatus.trial || 0,
    expired: byStatus.expired || 0,
    totalStudents: students,
    totalTeachers: teachers,
    monthlyRevenue: monthly._sum.amount || 0,
    annualRevenue: annual._sum.amount || 0,
    newSchools,
    pendingPayments,
    schools: toApi(schools),
    plans: PLANS,
  });
});

export const schoolDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const [
    students,
    teachers,
    classes,
    attnCounts,
    attnTaken,
    pendingFees,
    todayPay,
    monthPay,
    exams,
    events,
    notices,
    enquiries,
    homework,
    birthdays,
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId: tid, status: 'active' } }),
    prisma.teacher.count({ where: { tenantId: tid, status: 'active' } }),
    prisma.schoolClass.count({ where: { tenantId: tid } }),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { sheet: { tenantId: tid, date: today } },
      _count: { _all: true },
    }),
    prisma.attendanceSheet.count({ where: { tenantId: tid, date: today } }),
    prisma.feeInvoice.aggregate({
      where: { tenantId: tid, due: { gt: 0 } },
      _sum: { due: true },
    }),
    prisma.feePayment.aggregate({
      where: { tenantId: tid, paidAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    }),
    prisma.feePayment.aggregate({
      where: { tenantId: tid, paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.exam.findMany({
      where: { tenantId: tid },
      orderBy: { startDate: 'desc' },
      take: 5,
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
    }),
    prisma.calendarEvent.findMany({
      where: { tenantId: tid, startDate: { gte: today } },
      orderBy: { startDate: 'asc' },
      take: 5,
      select: { id: true, title: true, startDate: true, type: true },
    }),
    prisma.notice.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.enquiry.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, studentName: true, classApplying: true, status: true },
    }),
    prisma.homework.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.$queryRaw`
      SELECT id, "firstName", "lastName", dob
      FROM students
      WHERE "tenantId" = ${tid}::uuid
        AND status = 'active'
        AND dob IS NOT NULL
        AND EXTRACT(MONTH FROM dob) = ${month}
        AND EXTRACT(DAY FROM dob) = ${day}
      LIMIT 8
    `,
  ]);

  const attn = countByStatus(attnCounts);
  const present = (attn.present || 0) + (attn.late || 0);
  const leave = attn.leave || 0;
  const absent = (attn.absent || 0) + (attn.half_day || 0);

  res.json({
    students,
    teachers,
    classes,
    attendance: { present, absent, leave, taken: attnTaken },
    fees: {
      today: todayPay._sum.amount || 0,
      month: monthPay._sum.amount || 0,
      pending: pendingFees._sum.due || 0,
    },
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
  const teacherId = req.user.linkedTeacherId;
  const teacherWhere = teacherId
    ? { id: teacherId, tenantId: tid }
    : { tenantId: tid, userId: req.user._id };

  const [teacher, assigned, homework, notices] = await Promise.all([
    prisma.teacher.findFirst({
      where: teacherWhere,
      select: { id: true, name: true, designation: true, department: true, employeeId: true },
    }),
    prisma.classSubject.findMany({
      where: {
        tenantId: tid,
        ...(teacherId ? { teacherId } : { teacher: { userId: req.user._id } }),
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    }),
    prisma.homework.findMany({
      where: { tenantId: tid, ...(teacherId ? { teacherId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    }),
    prisma.notice.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  res.json({
    teacher: toApi(teacher),
    assigned: toApi(assigned),
    homework: toApi(homework),
    notices: toApi(notices),
  });
});

export const parentDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const parentId = req.user.linkedParentId;
  const parent = await prisma.parent.findFirst({
    where: parentId ? { id: parentId, tenantId: tid } : { tenantId: tid, userId: req.user._id },
    include: {
      students: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          classId: true,
          sectionId: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });
  const studentIds = parent?.students?.map((s) => s.id) || [];
  const classIds = [...new Set((parent?.students || []).map((s) => s.classId).filter(Boolean))];

  const [invoices, homework, notices, events, exams] = await Promise.all([
    prisma.feeInvoice.findMany({
      where: { tenantId: tid, studentId: { in: studentIds } },
      select: { id: true, due: true, total: true, status: true, invoiceNo: true },
    }),
    prisma.homework.findMany({
      where: { tenantId: tid, ...(classIds.length ? { classId: { in: classIds } } : {}) },
      orderBy: { dueDate: 'asc' },
      take: 8,
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.notice.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { tenantId: tid, startDate: { gte: startOfDay() } },
      orderBy: { startDate: 'asc' },
      take: 5,
      select: { id: true, title: true, startDate: true },
    }),
    prisma.exam.findMany({
      where: { tenantId: tid },
      orderBy: { startDate: 'desc' },
      take: 4,
      select: { id: true, name: true, startDate: true, status: true },
    }),
  ]);

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
  const studentId = req.user.linkedStudentId;
  const student = await prisma.student.findFirst({
    where: studentId ? { id: studentId, tenantId: tid } : { tenantId: tid, userId: req.user._id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rollNo: true,
      classId: true,
      sectionId: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!student) return res.json({ student: null });

  const [homework, notices, invoices] = await Promise.all([
    prisma.homework.findMany({
      where: { tenantId: tid, classId: student.classId },
      orderBy: { dueDate: 'asc' },
      take: 8,
      include: { subject: { select: { id: true, name: true } } },
    }),
    prisma.notice.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.feeInvoice.findMany({
      where: { tenantId: tid, studentId: student.id },
      select: { id: true, due: true, total: true, status: true, invoiceNo: true },
    }),
  ]);

  res.json({
    student: toApi(student),
    homework: toApi(homework),
    notices: toApi(notices),
    invoices: toApi(invoices),
  });
});
