import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
    admissionNo: { type: String, required: true },
    rollNo: String,
    firstName: { type: String, required: true },
    lastName: String,
    dob: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    bloodGroup: String,
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    photo: String,
    aadhaar: String,
    previousSchool: String,
    admissionDate: Date,
    status: { type: String, enum: ['active', 'inactive', 'transferred', 'alumni'], default: 'active' },
    address: String,
    city: String,
    state: String,
    pincode: String,
    fatherName: String,
    fatherPhone: String,
    motherName: String,
    motherPhone: String,
    guardianName: String,
    email: String,
    phone: String,
  },
  { timestamps: true }
);

studentSchema.index({ tenantId: 1, admissionNo: 1 }, { unique: true });
studentSchema.virtual('name').get(function name() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

export const Student = mongoose.model('Student', studentSchema);
