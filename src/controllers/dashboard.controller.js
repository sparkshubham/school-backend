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

function jsonList(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

export const superDashboard = asyncHandler(async (req, res) => {
  const monthStart = startOfMonth();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [row] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM tenants) AS "totalSchools",
      (SELECT COUNT(*)::int FROM tenants WHERE status = 'active') AS active,
      (SELECT COUNT(*)::int FROM tenants WHERE status = 'trial') AS trial,
      (SELECT COUNT(*)::int FROM tenants WHERE status = 'expired') AS expired,
      (SELECT COUNT(*)::int FROM students) AS "totalStudents",
      (SELECT COUNT(*)::int FROM teachers) AS "totalTeachers",
      (SELECT COALESCE(SUM(amount), 0)::float FROM subscription_payments WHERE status = 'paid' AND "paidAt" >= ${monthStart}) AS "monthlyRevenue",
      (SELECT COALESCE(SUM(amount), 0)::float FROM subscription_payments WHERE status = 'paid' AND "paidAt" >= ${yearStart}) AS "annualRevenue",
      (SELECT COUNT(*)::int FROM tenants WHERE "createdAt" >= ${monthStart}) AS "newSchools",
      (SELECT COUNT(*)::int FROM tenants WHERE status IN ('trial', 'expired')) AS "pendingPayments",
      (
        SELECT COALESCE(json_agg(s), '[]'::json) FROM (
          SELECT id, name, city, plan, status, "createdAt"
          FROM tenants
          ORDER BY "createdAt" DESC
          LIMIT 8
        ) s
      ) AS schools
  `;
  res.json({
    totalSchools: Number(row?.totalSchools || 0),
    active: Number(row?.active || 0),
    trial: Number(row?.trial || 0),
    expired: Number(row?.expired || 0),
    totalStudents: Number(row?.totalStudents || 0),
    totalTeachers: Number(row?.totalTeachers || 0),
    monthlyRevenue: Number(row?.monthlyRevenue || 0),
    annualRevenue: Number(row?.annualRevenue || 0),
    newSchools: Number(row?.newSchools || 0),
    pendingPayments: Number(row?.pendingPayments || 0),
    schools: toApi(jsonList(row?.schools)),
    plans: PLANS,
  });
});

export const schoolDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  if (!tid) {
    return res.json({
      students: 0,
      teachers: 0,
      classes: 0,
      attendance: { present: 0, absent: 0, leave: 0, taken: 0 },
      fees: { today: 0, month: 0, pending: 0 },
      exams: [],
      events: [],
      notices: [],
      enquiries: [],
      birthdays: [],
    });
  }
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const [row] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM students WHERE "tenantId" = ${tid}::uuid AND status = 'active') AS students,
      (SELECT COUNT(*)::int FROM teachers WHERE "tenantId" = ${tid}::uuid AND status = 'active') AS teachers,
      (SELECT COUNT(*)::int FROM school_classes WHERE "tenantId" = ${tid}::uuid) AS classes,
      (SELECT COUNT(*)::int FROM attendance_sheets WHERE "tenantId" = ${tid}::uuid AND date = ${today}::date) AS "attnTaken",
      (SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sheets s ON s.id = ar."sheetId" WHERE s."tenantId" = ${tid}::uuid AND s.date = ${today}::date AND ar.status IN ('present', 'late')) AS present,
      (SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sheets s ON s.id = ar."sheetId" WHERE s."tenantId" = ${tid}::uuid AND s.date = ${today}::date AND ar.status IN ('absent', 'half_day')) AS absent,
      (SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sheets s ON s.id = ar."sheetId" WHERE s."tenantId" = ${tid}::uuid AND s.date = ${today}::date AND ar.status = 'leave') AS leave,
      (SELECT COALESCE(SUM(due), 0)::float FROM fee_invoices WHERE "tenantId" = ${tid}::uuid AND due > 0) AS pending,
      (SELECT COALESCE(SUM(amount), 0)::float FROM fee_payments WHERE "tenantId" = ${tid}::uuid AND "paidAt" >= ${today} AND "paidAt" < ${tomorrow}) AS "todayPay",
      (SELECT COALESCE(SUM(amount), 0)::float FROM fee_payments WHERE "tenantId" = ${tid}::uuid AND "paidAt" >= ${monthStart}) AS "monthPay",
      (
        SELECT COALESCE(json_agg(e), '[]'::json) FROM (
          SELECT id, name, status, "startDate", "endDate" FROM exams
          WHERE "tenantId" = ${tid}::uuid ORDER BY "startDate" DESC NULLS LAST LIMIT 5
        ) e
      ) AS exams,
      (
        SELECT COALESCE(json_agg(ev), '[]'::json) FROM (
          SELECT id, title, "startDate", type FROM events
          WHERE "tenantId" = ${tid}::uuid AND "startDate" >= ${today}
          ORDER BY "startDate" ASC LIMIT 5
        ) ev
      ) AS events,
      (
        SELECT COALESCE(json_agg(n), '[]'::json) FROM (
          SELECT id, title, "createdAt" FROM notices
          WHERE "tenantId" = ${tid}::uuid ORDER BY "createdAt" DESC LIMIT 6
        ) n
      ) AS notices,
      (
        SELECT COALESCE(json_agg(q), '[]'::json) FROM (
          SELECT id, "studentName", "classApplying", status FROM enquiries
          WHERE "tenantId" = ${tid}::uuid ORDER BY "createdAt" DESC LIMIT 6
        ) q
      ) AS enquiries,
      (
        SELECT COALESCE(json_agg(b), '[]'::json) FROM (
          SELECT id, "firstName", "lastName", dob FROM students
          WHERE "tenantId" = ${tid}::uuid AND status = 'active' AND dob IS NOT NULL
            AND EXTRACT(MONTH FROM dob) = ${month} AND EXTRACT(DAY FROM dob) = ${day}
          LIMIT 8
        ) b
      ) AS birthdays
  `;

  res.json({
    students: Number(row?.students || 0),
    teachers: Number(row?.teachers || 0),
    classes: Number(row?.classes || 0),
    attendance: {
      present: Number(row?.present || 0),
      absent: Number(row?.absent || 0),
      leave: Number(row?.leave || 0),
      taken: Number(row?.attnTaken || 0),
    },
    fees: {
      today: Number(row?.todayPay || 0),
      month: Number(row?.monthPay || 0),
      pending: Number(row?.pending || 0),
    },
    exams: toApi(jsonList(row?.exams)),
    events: toApi(jsonList(row?.events)),
    notices: toApi(jsonList(row?.notices)),
    enquiries: toApi(jsonList(row?.enquiries)),
    birthdays: toApi(jsonList(row?.birthdays)),
  });
});

export const teacherDashboard = asyncHandler(async (req, res) => {
  const tid = req.tenantId;
  const teacherId = req.user.linkedTeacherId;
  const teacherWhere = teacherId
    ? { id: teacherId, tenantId: tid }
    : { tenantId: tid, userId: req.user._id };

  const teacher = await prisma.teacher.findFirst({
    where: teacherWhere,
    select: { id: true, name: true, designation: true, department: true, employeeId: true },
  });
  const assigned = await prisma.classSubject.findMany({
    where: {
      tenantId: tid,
      ...(teacherId ? { teacherId } : { teacher: { userId: req.user._id } }),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });
  const homework = await prisma.homework.findMany({
    where: { tenantId: tid, ...(teacherId ? { teacherId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, createdAt: true },
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

  const invoices = await prisma.feeInvoice.findMany({
    where: { tenantId: tid, studentId: { in: studentIds } },
    select: { id: true, due: true, total: true, status: true, invoiceNo: true },
  });
  const homework = await prisma.homework.findMany({
    where: { tenantId: tid, ...(classIds.length ? { classId: { in: classIds } } : {}) },
    orderBy: { dueDate: 'asc' },
    take: 8,
    include: {
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, title: true, createdAt: true },
  });
  const events = await prisma.calendarEvent.findMany({
    where: { tenantId: tid, startDate: { gte: startOfDay() } },
    orderBy: { startDate: 'asc' },
    take: 5,
    select: { id: true, title: true, startDate: true },
  });
  const exams = await prisma.exam.findMany({
    where: { tenantId: tid },
    orderBy: { startDate: 'desc' },
    take: 4,
    select: { id: true, name: true, startDate: true, status: true },
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

  const homework = await prisma.homework.findMany({
    where: { tenantId: tid, classId: student.classId },
    orderBy: { dueDate: 'asc' },
    take: 8,
    include: { subject: { select: { id: true, name: true } } },
  });
  const notices = await prisma.notice.findMany({
    where: { tenantId: tid },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, title: true, createdAt: true },
  });
  const invoices = await prisma.feeInvoice.findMany({
    where: { tenantId: tid, studentId: student.id },
    select: { id: true, due: true, total: true, status: true, invoiceNo: true },
  });

  res.json({
    student: toApi(student),
    homework: toApi(homework),
    notices: toApi(notices),
    invoices: toApi(invoices),
  });
});
