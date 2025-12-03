import mongoose from 'mongoose';

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.googleId; } }, // Required only if not using Google OAuth
  googleId: { type: String, unique: true, sparse: true }, // Google OAuth ID
  role: { type: String, enum: ['superadmin', 'admin', 'salesadmin', 'dataadmin', 'customer', 'investor', 'vendor', 'broker', 'user', 'partner'], default: 'customer' },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  verified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isReraVerified: { type: Boolean, default: false },
  reraId: { type: String, default: null },
  avatar: String,
  phone: String,
  company: String,
  pincode: String,
  locality: String,
  latitude: Number,
  longitude: Number,
  streetAddress: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// OTP Schema
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ['signup', 'password-reset'], required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now }
});

// Document Schema
const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: String,
  size: String,
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  url: String,
  uploadedAt: { type: Date, default: Date.now }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'pending' },
  method: { type: String, enum: ['PayPal', 'Credit Card', 'Razorpay'] },
  description: String,
  transactionId: String,
  createdAt: { type: Date, default: Date.now }
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Verification Schema - stores pending vendor/broker applications
const verificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['vendor', 'broker'], required: true },
  reraId: { type: String, required: true },
  phone: String,
  company: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: String,
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Map Registration Schema - stores user locations on map
const mapSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  locality: String,
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Project Schema - stores projects created by sales admin
const projectSchema = new mongoose.Schema({
  salesAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salesAdminName: { type: String, required: true },
  salesAdminEmail: { type: String, required: true },
  projectName: { type: String, required: true },
  priceRange: {
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },
  images: [String], // Array of image fileIds (GridFS) or paths (legacy) - no validation
  pincode: { type: String, required: true },
  areaName: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['not_started', 'working', 'finished'], 
    default: 'not_started' 
  }, // Calculated based on dates
  territories: [{ type: String }], // Array of pincodes/territories
  offers: [{
    title: String,
    description: String,
    discount: Number,
    validFrom: Date,
    validTo: Date,
    isActive: { type: Boolean, default: true }
  }],
  engagement: {
    views: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    lastViewed: Date
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Registered Professional Schema - stores registered professionals per pincode (max 2 per pincode)
const registeredProfessionalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Architect', 'Engineer', 'Interior Designer', 'Consultant'], 
    required: true 
  },
  languages: [{ 
    type: String, 
    enum: ['English', 'Hindi', 'Gujarati'] 
  }],
  latitude: { type: Number },
  longitude: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure max 2 professionals per pincode
registeredProfessionalSchema.index({ pincode: 1 });
registeredProfessionalSchema.index({ email: 1 }, { unique: true });

// Pre-save hook to validate max 2 professionals per pincode
registeredProfessionalSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('RegisteredProfessional').countDocuments({ pincode: this.pincode });
    if (count >= 2) {
      return next(new Error(`Maximum 2 professionals allowed per pincode. Pincode ${this.pincode} already has ${count} professionals.`));
    }
  }
  next();
});

// Property Schema - stores properties added by vendors for sale or lease
const propertySchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorName: { type: String, required: true },
  vendorEmail: { type: String, required: true },
  propertyName: { type: String, required: true },
  reason: { 
    type: String, 
    enum: ['lease', 'sale'], 
    required: true 
  },
  propertyType: { 
    type: String, 
    enum: ['land', 'house', 'factory', 'apartment', 'commercial', 'other'], 
    required: true 
  },
  location: { type: String, required: true },
  budget: { type: Number, required: true },
  pincode: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  area: { type: Number }, // Area in square feet or square meters
  contact: { type: String, required: true }, // Contact number
  description: String,
  images: { 
    type: [String], 
    default: [],
    required: false
  }, // Array of image fileIds (GridFS) or paths (legacy) - optional field
  assignedBrokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBrokerName: String,
  assignedBrokerEmail: String,
  status: { 
    type: String, 
    enum: ['active', 'sold', 'leased', 'inactive'], 
    default: 'active' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes for properties
propertySchema.index({ vendorId: 1 });
propertySchema.index({ pincode: 1 });
propertySchema.index({ reason: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ latitude: 1, longitude: 1 });
propertySchema.index({ assignedBrokerId: 1 });

// Meeting Schema - stores meeting requests and arrangements
const meetingSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  propertyName: { type: String, required: true },
  propertyLocation: { type: String, required: true },
  propertyBudget: { type: Number, required: true },
  propertyType: { type: String, required: true },
  propertyReason: { type: String, enum: ['sale', 'lease'], required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorName: { type: String, required: true },
  vendorEmail: { type: String, required: true },
  brokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  brokerName: { type: String, required: true },
  brokerEmail: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'scheduled', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  meetingDate: Date,
  meetingTime: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes for meetings
meetingSchema.index({ brokerId: 1 });
meetingSchema.index({ customerId: 1 });
meetingSchema.index({ vendorId: 1 });
meetingSchema.index({ propertyId: 1 });
meetingSchema.index({ status: 1 });

// Create and export models
export const User = mongoose.model('User', userSchema);
export const OTP = mongoose.model('OTP', otpSchema);
export const Document = mongoose.model('Document', documentSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Verification = mongoose.model('Verification', verificationSchema);
export const Map = mongoose.model('Map', mapSchema);
export const Project = mongoose.model('Project', projectSchema);
export const RegisteredProfessional = mongoose.model('RegisteredProfessional', registeredProfessionalSchema);
export const Property = mongoose.model('Property', propertySchema);
export const Meeting = mongoose.model('Meeting', meetingSchema);
