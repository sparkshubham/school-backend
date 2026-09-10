import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    dob: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    phone: String,
    email: String,
    qualification: String,
    experience: Number,
    joiningDate: Date,
    department: String,
    designation: String,
    salary: Number,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

teacherSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });

export const Teacher = mongoose.model('Teacher', teacherSchema);
