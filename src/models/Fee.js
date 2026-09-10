import mongoose from 'mongoose';

const feeStructureSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    items: [{ name: String, amount: Number, optional: { type: Boolean, default: false } }],
  },
  { timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    invoiceNo: String,
    items: [{ name: String, amount: Number }],
    total: Number,
    paid: { type: Number, default: 0 },
    due: Number,
    dueDate: Date,
    status: { type: String, enum: ['unpaid', 'partial', 'paid', 'overdue'], default: 'unpaid' },
    discount: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'online'], default: 'cash' },
    txnId: String,
    receiptNo: String,
    paidAt: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

export const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
export const FeeInvoice = mongoose.model('FeeInvoice', invoiceSchema);
export const FeePayment = mongoose.model('FeePayment', paymentSchema);
