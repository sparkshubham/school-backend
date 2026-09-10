import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    logo: String,
    email: String,
    phone: String,
    website: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    principalName: String,
    registrationNo: String,
    affiliation: String,
    academicSession: String,
    status: { type: String, enum: ['trial', 'active', 'expired', 'suspended'], default: 'trial' },
    plan: { type: String, enum: ['basic', 'professional', 'enterprise'], default: 'basic' },
    modules: [String],
    trialEndsAt: Date,
    subscriptionEndsAt: Date,
    branding: {
      primaryColor: { type: String, default: '#0f766e' },
    },
  },
  { timestamps: true }
);

export const Tenant = mongoose.model('Tenant', tenantSchema);
