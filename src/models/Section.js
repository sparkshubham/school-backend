import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
    name: { type: String, required: true },
    capacity: { type: Number, default: 40 },
  },
  { timestamps: true }
);

export const Section = mongoose.model('Section', sectionSchema);
