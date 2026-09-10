import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    isbn: String,
    name: { type: String, required: true },
    author: String,
    publisher: String,
    category: String,
    rack: String,
    quantity: { type: Number, default: 1 },
    available: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const issueSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    returnDate: Date,
    fine: { type: Number, default: 0 },
    status: { type: String, enum: ['issued', 'returned', 'overdue'], default: 'issued' },
  },
  { timestamps: true }
);

export const Book = mongoose.model('Book', bookSchema);
export const BookIssue = mongoose.model('BookIssue', issueSchema);
