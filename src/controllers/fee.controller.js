import { FeeStructure, FeeInvoice, FeePayment } from '../models/Fee.js';
import { Student } from '../models/Student.js';
import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

function receiptNo() {
  return `RCP-${Date.now().toString(36).toUpperCase()}`;
}
function invoiceNo() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

export const listStructures = asyncHandler(async (req, res) => {
  const items = await FeeStructure.find(tenantScope({}, req)).populate('classId sessionId');
  res.json({ items });
});

export const saveStructure = asyncHandler(async (req, res) => {
  const body = { ...req.body, tenantId: req.tenantId };
  let item;
  if (req.params.id) {
    item = await FeeStructure.findOneAndUpdate(tenantScope({ _id: req.params.id }, req), body, { new: true });
  } else {
    item = await FeeStructure.create(body);
  }
  res.status(req.params.id ? 200 : 201).json(item);
});

export const generateInvoices = asyncHandler(async (req, res) => {
  const { classId, sessionId, dueDate } = req.body;
  const structure = await FeeStructure.findOne(tenantScope({ classId, ...(sessionId ? { sessionId } : {}) }, req));
  if (!structure) throw new AppError('Fee structure not found for this class');
  const students = await Student.find(tenantScope({ classId, status: 'active' }, req));
  const created = [];
  for (const student of students) {
    const exists = await FeeInvoice.findOne({ tenantId: req.tenantId, studentId: student._id, sessionId: structure.sessionId });
    if (exists) continue;
    const total = structure.items.reduce((s, i) => s + (i.amount || 0), 0);
    created.push(
      await FeeInvoice.create({
        tenantId: req.tenantId,
        studentId: student._id,
        sessionId: structure.sessionId,
        invoiceNo: invoiceNo(),
        items: structure.items,
        total,
        paid: 0,
        due: total,
        dueDate: dueDate || new Date(),
        status: 'unpaid',
      })
    );
  }
  res.json({ created: created.length, items: created });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const filter = tenantScope({}, req);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  const items = await FeeInvoice.find(filter)
    .populate({ path: 'studentId', populate: { path: 'classId sectionId' } })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ items });
});

export const collect = asyncHandler(async (req, res) => {
  const { invoiceId, amount, method, notes, txnId } = req.body;
  const invoice = await FeeInvoice.findOne(tenantScope({ _id: invoiceId }, req));
  if (!invoice) throw new AppError('Invoice not found', 404);
  const payAmount = Number(amount);
  if (payAmount <= 0) throw new AppError('Amount must be greater than 0');
  const payment = await FeePayment.create({
    tenantId: req.tenantId,
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount: payAmount,
    method: method || 'cash',
    txnId,
    receiptNo: receiptNo(),
    notes,
  });
  invoice.paid += payAmount;
  invoice.due = Math.max(0, invoice.total - invoice.discount + invoice.lateFee - invoice.paid);
  invoice.status = invoice.due <= 0 ? 'paid' : 'partial';
  await invoice.save();
  res.status(201).json({ payment, invoice });
});

export const payments = asyncHandler(async (req, res) => {
  const filter = tenantScope({}, req);
  if (req.query.studentId) filter.studentId = req.query.studentId;
  const items = await FeePayment.find(filter)
    .populate('studentId invoiceId')
    .sort({ paidAt: -1 })
    .limit(200);
  res.json({ items });
});

export const feeReport = asyncHandler(async (req, res) => {
  const invoices = await FeeInvoice.find(tenantScope({}, req)).populate({
    path: 'studentId',
    populate: { path: 'classId' },
  });
  const paymentsList = await FeePayment.find(tenantScope({}, req));
  const collected = paymentsList.reduce((s, p) => s + p.amount, 0);
  const pending = invoices.reduce((s, i) => s + (i.due || 0), 0);
  const overdue = invoices.filter((i) => i.due > 0 && i.dueDate && i.dueDate < new Date());
  res.json({
    collected,
    pending,
    overdueAmount: overdue.reduce((s, i) => s + i.due, 0),
    overdueCount: overdue.length,
    invoices,
  });
});
