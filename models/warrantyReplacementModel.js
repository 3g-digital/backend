const mongoose = require('mongoose');

const warrantyReplacementSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  originalWorkOrderId: {
    type: String,
    required: true
  },
  
  // Issues array to store all issues
  issues: [{
    issueDescription: {
      type: String,
      required: true
    },
    issueCheckedBy: {
      type: String,
      required: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    replacementSerialNumber: {
      type: String
    },
    replacedAt: {
      type: Date
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Current active status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'replaced'],
    default: 'pending'
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Performance optimization indexes
warrantyReplacementSchema.index({ serialNumber: 1 }); // For serial number lookup
warrantyReplacementSchema.index({ customerId: 1, status: 1 }); // For customer warranty queries
warrantyReplacementSchema.index({ status: 1, registeredAt: -1 }); // For filtering by status and sorting

const WarrantyReplacement = mongoose.model('WarrantyReplacement', warrantyReplacementSchema);
module.exports = WarrantyReplacement;