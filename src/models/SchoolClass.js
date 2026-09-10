import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    numeric: Number,
    order: Number,
  },
  { timestamps: true }
);

export const SchoolClass = mongoose.model('SchoolClass', classSchema);
