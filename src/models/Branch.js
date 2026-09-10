import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    code: String,
    address: String,
    phone: String,
    isMain: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Branch = mongoose.model('Branch', branchSchema);
