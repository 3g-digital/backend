const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['serialized-product', 'generic-product', 'service'],
    required: true
  },
  serialNumber: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
});

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  workOrder: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [billItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
   // ✅ New Payment Flow Fields
  amountPaid: {
    type: Number,
    required: true,
    default: 0
  },
  amountDue: {
    type: Number,
    required: true
  },
  extendedPaymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },

  // ✅ Bill Status & Rejection Tracking
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  },
  isReverted: {
    type: Boolean,
    default: false
  },

  // ✅ Payment & Timestamps
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'online', 'pending', 'no_payment'],
    default: 'pending'
  },
  transactionId: {
    type: String
  },
  paymentDetails: {
    type: Object,
    default: {}
  },
  paidAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Track who created this bill (admin or manager)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'manager']
  },
  createdByName: {
    type: String
  },
  // Store inventory update information for processing during payment confirmation
  itemsToUpdate: {
    type: Array,
    default: []
  }
}, { timestamps: true });

// Performance optimization indexes
billSchema.index({ customer: 1, status: 1 }); // For customer bills with status filter
billSchema.index({ orderId: 1 }); // For quick order lookup
billSchema.index({ technician: 1 }); // For technician bills
billSchema.index({ status: 1, createdAt: -1 }); // For filtering by status and sorting

const BillModel = mongoose.model('Bill', billSchema);
module.exports = BillModel;