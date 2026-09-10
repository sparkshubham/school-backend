import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    date: { type: Date, required: true },
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    records: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ['present', 'absent', 'late', 'half_day', 'leave'], required: true },
      },
    ],
  },
  { timestamps: true }
);

attendanceSchema.index({ tenantId: 1, classId: 1, sectionId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
