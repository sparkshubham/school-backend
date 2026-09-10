import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },
    priceMonthly: Number,
    priceYearly: Number,
    modules: [String],
    description: String,
  },
  { timestamps: true }
);

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    amount: Number,
    plan: String,
    period: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'paid' },
    paidAt: Date,
  },
  { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);
export const SubscriptionPayment = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
