const BankAccount = require('../../models/bankAccountModel');

async function addBankAccountController(req, res) {
  try {
    // Only admin can add bank accounts
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin role required.',
        error: true,
        success: false
      });
    }

    const {
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      upiId,
      isPrimary
    } = req.body;

    // Validation
    if (!bankName || !accountNumber || !ifscCode || !accountHolderName) {
      return res.status(400).json({
        message: 'Bank name, account number, IFSC code, and account holder name are required',
        error: true,
        success: false
      });
    }

    // Check if account number already exists
    const existingAccount = await BankAccount.findOne({
      accountNumber: accountNumber
    });

    if (existingAccount) {
      return res.status(400).json({
        message: 'Account number already exists',
        error: true,
        success: false
      });
    }

    // If this is set as primary, check if admin already has a primary account
    if (isPrimary) {
      const existingPrimary = await BankAccount.findOne({
        adminId: req.userId,
        isPrimary: true,
        status: 'active'
      });

      if (existingPrimary) {
        return res.status(400).json({
          message: 'You already have a primary account. Please update the existing one or set this as non-primary.',
          error: true,
          success: false
        });
      }
    }

    const newBankAccount = new BankAccount({
      bankName,
      accountNumber,
      ifscCode: ifscCode.toUpperCase(),
      accountHolderName,
      upiId: upiId || null,
      isPrimary: isPrimary || false,
      adminId: req.userId
    });

    const savedAccount = await newBankAccount.save();

    res.status(201).json({
      data: savedAccount,
      message: 'Bank account added successfully',
      success: true,
      error: false
    });

  } catch (err) {
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Account number already exists',
        error: true,
        success: false
      });
    }

    res.status(400).json({
      message: err.message || 'Failed to add bank account',
      error: true,
      success: false
    });
  }
}

module.exports = addBankAccountController;