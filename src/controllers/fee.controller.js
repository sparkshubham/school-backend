import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { tenantWhere, flattenInput, toApi, toPrismaDate } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { parsePaging, pageFromRows } from '../utils/paging.js';

function receiptNo() {
  return `RCP-${Date.now().toString(36).toUpperCase()}`;
}
function invoiceNo() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

const structureInclude = { class: true, session: true, items: true };
const invoiceListInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
};

export const listStructures = asyncHandler(async (req, res) => {
  const where = tenantWhere(req, {});
  const { page, limit, skip } = parsePaging(req);
  const items = await prisma.feeStructure.findMany({
    where,
    include: structureInclude,
    skip,
    take: limit,
  });
  res.json(pageFromRows(toApi(items), page, limit, skip));
});

export const saveStructure = asyncHandler(async (req, res) => {
  const items = (req.body.items || []).map((i) => ({
    name: i.name,
    amount: Number(i.amount) || 0,
    optional: Boolean(i.optional),
  }));
  const data = flattenInput({ ...req.body, tenantId: req.tenantId });
  delete data.items;
  let item;
  if (req.params.id) {
    const existing = await prisma.feeStructure.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
    if (!existing) throw new AppError('Fee structure not found', 404);
    item = await prisma.feeStructure.update({
      where: { id: existing.id },
      data: {
        ...data,
        items: { deleteMany: {}, create: items },
      },
      include: structureInclude,
    });
  } else {
    item = await prisma.feeStructure.create({
      data: { ...data, items: { create: items } },
      include: structureInclude,
    });
  }
  res.status(req.params.id ? 200 : 201).json(toApi(item));
});

export const generateInvoices = asyncHandler(async (req, res) => {
  const { classId, sessionId, dueDate } = req.body;
  const structure = await prisma.feeStructure.findFirst({
    where: tenantWhere(req, { classId, ...(sessionId ? { sessionId } : {}) }),
    include: { items: true },
  });
  if (!structure) throw new AppError('Fee structure not found for this class');
  const students = await prisma.student.findMany({
    where: tenantWhere(req, { classId, status: 'active' }),
    select: { id: true },
  });
  if (!students.length) return res.json({ created: 0, items: [] });
  const existingIds = await prisma.feeInvoice.findMany({
    where: {
      tenantId: req.tenantId,
      studentId: { in: students.map((s) => s.id) },
      sessionId: structure.sessionId,
    },
    select: { studentId: true },
  });
  const have = new Set(existingIds.map((e) => e.studentId));
  const created = [];
  const total = structure.items.reduce((s, i) => s + (i.amount || 0), 0);
  for (const student of students) {
    if (have.has(student.id)) continue;
    created.push(
      await prisma.feeInvoice.create({
        data: {
          tenantId: req.tenantId,
          studentId: student.id,
          sessionId: structure.sessionId,
          invoiceNo: invoiceNo(),
          items: {
            create: structure.items.map((i) => ({ name: i.name, amount: i.amount })),
          },
          total,
          paid: 0,
          due: total,
          dueDate: toPrismaDate(dueDate) || new Date(),
          status: 'unpaid',
        },
        include: { items: true },
      })
    );
  }
  res.json({ created: created.length, items: toApi(created) });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const filter = tenantWhere(req, {});
  if (req.query.status) filter.status = req.query.status;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  const { page, limit, skip } = parsePaging(req);
  const items = await prisma.feeInvoice.findMany({
    where: filter,
    include: invoiceListInclude,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
  res.json(pageFromRows(toApi(items), page, limit, skip));
});

export const collect = asyncHandler(async (req, res) => {
  const { invoiceId, amount, method, notes, txnId } = req.body;
  const invoice = await prisma.feeInvoice.findFirst({
    where: tenantWhere(req, { id: invoiceId }),
  });
  if (!invoice) throw new AppError('Invoice not found', 404);
  const payAmount = Number(amount);
  if (payAmount <= 0) throw new AppError('Amount must be greater than 0');
  const payment = await prisma.feePayment.create({
    data: {
      tenantId: req.tenantId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amount: payAmount,
      method: method || 'cash',
      txnId: txnId || null,
      receiptNo: receiptNo(),
      notes: notes || null,
    },
  });
  const paid = invoice.paid + payAmount;
  const due = Math.max(0, invoice.total - invoice.discount + invoice.lateFee - paid);
  const updated = await prisma.feeInvoice.update({
    where: { id: invoice.id },
    data: {
      paid,
      due,
      status: due <= 0 ? 'paid' : 'partial',
    },
    include: { items: true },
  });
  res.status(201).json({ payment: toApi(payment), invoice: toApi(updated) });
});

export const payments = asyncHandler(async (req, res) => {
  const filter = tenantWhere(req, {});
  if (req.query.studentId) filter.studentId = req.query.studentId;
  const { page, limit, skip } = parsePaging(req);
  const items = await prisma.feePayment.findMany({
    where: filter,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      invoice: { select: { id: true, invoiceNo: true } },
    },
    orderBy: { paidAt: 'desc' },
    skip,
    take: limit,
  });
  res.json(pageFromRows(toApi(items), page, limit, skip));
});

export const feeReport = asyncHandler(async (req, res) => {
  const tid = tenantWhere(req, {}).tenantId;
  const tenantSql = tid ? Prisma.sql`AND "tenantId" = ${tid}::uuid` : Prisma.sql``;
  const [row] = await prisma.$queryRaw`
    SELECT
      (SELECT COALESCE(SUM(amount), 0)::float FROM fee_payments WHERE TRUE ${tenantSql}) AS collected,
      (SELECT COALESCE(SUM(due), 0)::float FROM fee_invoices WHERE TRUE ${tenantSql}) AS pending,
      (SELECT COALESCE(SUM(due), 0)::float FROM fee_invoices WHERE due > 0 AND "dueDate" < NOW() ${tenantSql}) AS "overdueAmount",
      (SELECT COUNT(*)::int FROM fee_invoices WHERE due > 0 AND "dueDate" < NOW() ${tenantSql}) AS "overdueCount"
  `;
  res.json({
    collected: Number(row?.collected || 0),
    pending: Number(row?.pending || 0),
    overdueAmount: Number(row?.overdueAmount || 0),
    overdueCount: Number(row?.overdueCount || 0),
  });
});
