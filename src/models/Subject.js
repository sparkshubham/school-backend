import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    code: String,
    type: { type: String, enum: ['theory', 'practical'], default: 'theory' },
  },
  { timestamps: true }
);

export const Subject = mongoose.model('Subject', subjectSchema);
