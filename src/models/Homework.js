import mongoose from 'mongoose';

const homeworkSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    title: { type: String, required: true },
    description: String,
    dueDate: Date,
    attachments: [String],
  },
  { timestamps: true }
);

const submissionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    files: [String],
    submittedAt: { type: Date, default: Date.now },
    marks: Number,
    feedback: String,
  },
  { timestamps: true }
);

export const Homework = mongoose.model('Homework', homeworkSchema);
export const HomeworkSubmission = mongoose.model('HomeworkSubmission', submissionSchema);
