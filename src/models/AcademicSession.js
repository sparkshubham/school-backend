import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AcademicSession = mongoose.model('AcademicSession', sessionSchema);
