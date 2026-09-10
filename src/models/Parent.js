import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    relation: { type: String, default: 'father' },
    phone: String,
    email: String,
    occupation: String,
    address: String,
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  },
  { timestamps: true }
);

export const Parent = mongoose.model('Parent', parentSchema);
