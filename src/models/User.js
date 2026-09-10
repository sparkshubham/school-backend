import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    password: { type: String, required: true, select: false },
    role: { type: String, required: true, index: true },
    avatar: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    permissions: [String],
    linkedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    linkedParentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
    linkedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ email: 1, tenantId: 1 }, { unique: true });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.model('User', userSchema);
