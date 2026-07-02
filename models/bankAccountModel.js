const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    unique: true,
    trim: true
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required'],
    trim: true,
    uppercase: true
  },
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true
  },
  upiId: {
    type: String,
    trim: true,
    default: null
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for better performance
BankAccountSchema.index({ adminId: 1 });
// Note: accountNumber index is automatically created by unique: true

// Pre-save middleware to ensure only one primary account per admin
BankAccountSchema.pre('save', async function(next) {
  if (this.isPrimary && this.isModified('isPrimary')) {
    // Remove primary status from other accounts of same admin
    await this.constructor.updateMany(
      {
        adminId: this.adminId,
        _id: { $ne: this._id }
      },
      { isPrimary: false }
    );
  }
  next();
});

const BankAccount = mongoose.model('BankAccount', BankAccountSchema);
module.exports = BankAccount;