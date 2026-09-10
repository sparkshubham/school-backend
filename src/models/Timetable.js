import mongoose from 'mongoose';

const periodSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    startTime: String,
    endTime: String,
    order: Number,
    isBreak: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const slotSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    room: String,
  },
  { timestamps: true }
);

export const Period = mongoose.model('Period', periodSchema);
export const TimetableSlot = mongoose.model('TimetableSlot', slotSchema);
