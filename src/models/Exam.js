import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    name: { type: String, required: true },
    type: { type: String, default: 'term' },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['draft', 'scheduled', 'ongoing', 'completed'], default: 'scheduled' },
  },
  { timestamps: true }
);

const examSubjectSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' },
    maxMarks: { type: Number, default: 100 },
    passMarks: { type: Number, default: 33 },
    date: Date,
    startTime: String,
  },
  { timestamps: true }
);

const markSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    examSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSubject', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    obtained: { type: Number, required: true },
    grade: String,
  },
  { timestamps: true }
);

markSchema.index({ examSubjectId: 1, studentId: 1 }, { unique: true });

export const Exam = mongoose.model('Exam', examSchema);
export const ExamSubject = mongoose.model('ExamSubject', examSubjectSchema);
export const Mark = mongoose.model('Mark', markSchema);
