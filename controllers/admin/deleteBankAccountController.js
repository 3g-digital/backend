const BankAccount = require('../../models/bankAccountModel');
const mongoose = require('mongoose');

async function deleteBankAccountController(req, res) {
  try {
    // Only admin can delete bank accounts
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin role required.',
        error: true,
        success: false
      });
    }

    const { accountId } = req.params;

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

    // Permanently delete the account from database
    const deletedAccount = await BankAccount.findByIdAndDelete(accountId);

    res.json({
      data: deletedAccount,
      message: 'Bank account deleted successfully',
      success: true,
      error: false
    });

  } catch (err) {
    res.status(400).json({
      message: err.message || 'Failed to delete bank account',
      error: true,
      success: false
    });
  }
}

module.exports = deleteBankAccountController;