const BankAccount = require('../../models/bankAccountModel');
const mongoose = require('mongoose');

async function updateBankAccountController(req, res) {
  try {
    // Only admin can update bank accounts
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin role required.',
        error: true,
        success: false
      });
    }

    const { accountId } = req.params;
    const {
      bankName,
      accountNumber,
      ifscCode,
      accountHolderName,
      upiId,
      isPrimary
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({
        message: 'Invalid account ID',
        error: true,
        success: false
      });
    }

    // Find the account and ensure it belongs to current admin
    const existingAccount = await BankAccount.findOne({
      _id: accountId,
      adminId: req.userId,
      status: 'active'
    });

    if (!existingAccount) {
      return res.status(404).json({
        message: 'Bank account not found',
        error: true,
        success: false
      });
    }

    // Check if account number is being changed and if it already exists
    if (accountNumber && accountNumber !== existingAccount.accountNumber) {
      const duplicateAccount = await BankAccount.findOne({
        accountNumber: accountNumber,
        _id: { $ne: accountId }
      });

      if (duplicateAccount) {
        return res.status(400).json({
          message: 'Account number already exists',
          error: true,
          success: false
        });
      }
    }

    // Handle primary account logic
    if (isPrimary && !existingAccount.isPrimary) {
      // Remove primary status from other accounts of same admin
      await BankAccount.updateMany(
        {
          adminId: req.userId,
          _id: { $ne: accountId },
          status: 'active'
        },
        { isPrimary: false }
      );
    }

    // Update the account
    const updateData = {};
    if (bankName) updateData.bankName = bankName;
    if (accountNumber) updateData.accountNumber = accountNumber;
    if (ifscCode) updateData.ifscCode = ifscCode.toUpperCase();
    if (accountHolderName) updateData.accountHolderName = accountHolderName;
    if (upiId !== undefined) updateData.upiId = upiId || null;
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;

    const updatedAccount = await BankAccount.findByIdAndUpdate(
      accountId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      data: updatedAccount,
      message: 'Bank account updated successfully',
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
      message: err.message || 'Failed to update bank account',
      error: true,
      success: false
    });
  }
}

module.exports = updateBankAccountController;