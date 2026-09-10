import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    number: { type: String, required: true },
    type: { type: String, default: 'bus' },
    capacity: Number,
    driverName: String,
    driverPhone: String,
  },
  { timestamps: true }
);

const routeSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    stops: [{ name: String, order: Number, pickupTime: String }],
  },
  { timestamps: true }
);

const studentTransportSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute' },
    stopName: String,
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export const TransportRoute = mongoose.model('TransportRoute', routeSchema);
export const StudentTransport = mongoose.model('StudentTransport', studentTransportSchema);
