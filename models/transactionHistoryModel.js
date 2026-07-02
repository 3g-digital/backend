const mongoose = require('mongoose');

const transactionHistorySchema = new mongoose.Schema({
  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'customerType'
  },
  customerType: {
    type: String,
    required: true,
    enum: ['distributor', 'dealer', 'customer']
  },
  customerName: {
    type: String,
    required: true
  },

  // Transaction Details
  transactionType: {
    type: String,
    required: true,
    enum: ['payment_received', 'due_payment', 'partial_payment', 'full_payment']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },

  // Payment Method Details
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque']
  },
  transactionId: {
    type: String, // UPI Transaction ID, UTR Number, etc.
    default: null
  },
  paymentDetails: {
    // UPI details
    upiTransactionId: String,
    selectedBankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount'
    },

    // Bank Transfer details
    utrNumber: String,
    bankName: String,
    transferDate: Date,
    receivedAmount: Number,

    // Cheque details
    chequeNumber: String,
    chequeBank: String,
    chequeIfsc: String,
    chequeDate: Date,
    chequeAmount: Number,
    drawerName: String,
    chequeStatus: {
      type: String,
      enum: ['received', 'cleared', 'bounced'],
      default: 'received'
    }
  },

  // Associated Bill Information (if any)
  relatedBills: [{
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesBill'
    },
    billNumber: String,
    allocatedAmount: Number
  }],

  // Transaction Status
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  },

  // Notes and Additional Info
  notes: String,

  // Branch Information
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },

  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
transactionHistorySchema.index({ customerId: 1, customerType: 1 });
transactionHistorySchema.index({ createdAt: -1 });
transactionHistorySchema.index({ transactionType: 1 });
transactionHistorySchema.index({ paymentMethod: 1 });

// Virtual for transaction display formatting
transactionHistorySchema.virtual('displayAmount').get(function() {
  return `+₹${this.amount}`;
});

// Virtual for transaction date formatting
transactionHistorySchema.virtual('displayDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
});

module.exports = mongoose.model('TransactionHistory', transactionHistorySchema);