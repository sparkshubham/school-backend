import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    body: String,
    audience: { type: String, enum: ['all', 'students', 'teachers', 'parents', 'class', 'staff'], default: 'all' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    pinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const eventSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, default: 'event' },
    startDate: Date,
    endDate: Date,
    description: String,
  },
  { timestamps: true }
);

const enquirySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentName: { type: String, required: true },
    parentName: String,
    phone: String,
    classApplying: String,
    previousSchool: String,
    source: String,
    followUpDate: Date,
    status: {
      type: String,
      enum: ['new', 'contacted', 'interested', 'visit_scheduled', 'application', 'selected', 'rejected', 'admitted'],
      default: 'new',
    },
    notes: String,
  },
  { timestamps: true }
);

const leaveSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: String,
    type: { type: String, enum: ['casual', 'sick', 'earned', 'emergency'], default: 'casual' },
    fromDate: Date,
    toDate: Date,
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const complaintSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, default: 'general' },
    title: String,
    body: String,
    status: { type: String, enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

export const Notice = mongoose.model('Notice', noticeSchema);
export const Event = mongoose.model('Event', eventSchema);
export const Enquiry = mongoose.model('Enquiry', enquirySchema);
export const LeaveRequest = mongoose.model('LeaveRequest', leaveSchema);
export const Complaint = mongoose.model('Complaint', complaintSchema);
