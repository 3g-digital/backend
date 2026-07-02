const BankAccount = require('../../models/bankAccountModel');

async function getBankAccountsController(req, res) {
  try {
    // Admin, Manager, and Technician can access bank accounts (for payments)
    if (req.userRole !== 'admin' && req.userRole !== 'manager' && req.userRole !== 'technician') {
      return res.status(403).json({
        message: 'Access denied. Admin, Manager, or Technician role required.',
        error: true,
        success: false
      });
    }

    let query = { status: 'active' };

    // If admin, get their own accounts
    if (req.userRole === 'admin') {
      query.adminId = req.userId;
    } else if (req.userRole === 'manager' || req.userRole === 'technician') {
      // If manager or technician, get all admin accounts (for payment processing)
      // Don't filter by adminId so they can see all admin bank accounts
      query = { status: 'active' };
    }

    const bankAccounts = await BankAccount.find(query).sort({ isPrimary: -1, createdAt: -1 });

    res.json({
      data: bankAccounts,
      message: 'Bank accounts retrieved successfully',
      success: true,
      error: false
    });

  } catch (err) {
    res.status(400).json({
      message: err.message || 'Failed to retrieve bank accounts',
      error: true,
      success: false
    });
  }
}

module.exports = getBankAccountsController;