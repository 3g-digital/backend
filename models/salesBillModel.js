const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  itemName: {
    type: String,
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
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const salesBillSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerType: {
    type: String,
    enum: ['dealer', 'distributor', 'customer'],
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'customerModel'
  },
  customerModel: {
    type: String,
    required: true,
    enum: ['Dealer', 'Distributor', 'Customer']
  },
  customerName: {
    type: String,
    required: true
  },
  customerFirmName: {
    type: String
  },
  customerPhone: {
    type: String,
    required: true
  },
  items: [billItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    required: true
  },
  receivedAmount: {
    type: Number,
    default: function() { return this.paidAmount; }
  },
  transactionId: {
    type: String
  },
  qrCodeData: {
    type: String
  },
  paymentDetails: {
    // For Bank Transfer (IMPS)
    utrNumber: { type: String },
    bankName: { type: String },
    transferDate: { type: Date },

    // For Cheque
    chequeNumber: { type: String },
    chequeBank: { type: String },
    chequeIfsc: { type: String },
    chequeDate: { type: Date },
    chequeAmount: { type: Number },
    drawerName: { type: String },
    chequeStatus: {
      type: String,
      enum: ['received', 'cleared', 'bounced'],
      default: 'received'
    },

    // For UPI (enhanced)
    upiTransactionId: { type: String },
    selectedBankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount'
    }
  },
  notes: {
    type: String
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'manager']
  },
  createdByName: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Bill number is now generated in the controller before saving

// Create indexes for better performance
// Note: billNumber already has unique index from schema definition
salesBillSchema.index({ customerId: 1, customerType: 1 });
salesBillSchema.index({ createdAt: -1 });
salesBillSchema.index({ branch: 1 });

const salesBillModel = mongoose.model('SalesBill', salesBillSchema);

module.exports = salesBillModel;