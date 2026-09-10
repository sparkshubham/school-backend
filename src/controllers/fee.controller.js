import { prisma } from '../config/db.js';
import { tenantWhere, flattenInput, toApi } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';

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
  const items = await prisma.feeStructure.findMany({
    where: tenantWhere(req, {}),
    include: structureInclude,
  });
  res.json({ items: toApi(items) });
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
          dueDate: dueDate || new Date(),
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
  const items = await prisma.feeInvoice.findMany({
    where: filter,
    include: invoiceListInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ items: toApi(items) });
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
  const items = await prisma.feePayment.findMany({
    where: filter,
    include: { student: true, invoice: true },
    orderBy: { paidAt: 'desc' },
    take: 200,
  });
  res.json({ items: toApi(items) });
});

export const feeReport = asyncHandler(async (req, res) => {
  const where = tenantWhere(req, {});
  const [collected, pending, overdue] = await Promise.all([
    prisma.feePayment.aggregate({ where, _sum: { amount: true } }),
    prisma.feeInvoice.aggregate({ where, _sum: { due: true } }),
    prisma.feeInvoice.aggregate({
      where: { ...where, due: { gt: 0 }, dueDate: { lt: new Date() } },
      _sum: { due: true },
      _count: { _all: true },
    }),
  ]);
  res.json({
    collected: collected._sum.amount || 0,
    pending: pending._sum.due || 0,
    overdueAmount: overdue._sum.due || 0,
    overdueCount: overdue._count._all || 0,
  });
});
