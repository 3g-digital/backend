const TransactionHistory = require('../../models/transactionHistoryModel');

async function getTransactionHistory(req, res) {
  try {
    const { customerId } = req.params;
    const { customerType } = req.query;

    // Validate required parameters
    if (!customerId || !customerType) {
      return res.status(400).json({
        message: "Customer ID and customer type are required",
        error: true,
        success: false
      });
    }

    // Validate customer type
    const validCustomerTypes = ['distributor', 'dealer', 'customer'];
    if (!validCustomerTypes.includes(customerType)) {
      return res.status(400).json({
        message: "Invalid customer type. Must be distributor, dealer, or customer",
        error: true,
        success: false
      });
    }

    // Fetch transaction history
    const transactions = await TransactionHistory.find({
      customerId: customerId,
      customerType: customerType
    })
    .populate('createdBy', 'firstName lastName')
    .populate('branch', 'name')
    .populate({
      path: 'paymentDetails.selectedBankAccount',
      select: 'bankName accountHolderName upiId'
    })
    .sort({ createdAt: -1 }) // Latest first
    .lean();

    // Format transactions for PayTM-style display
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      type: 'payment',
      amount: transaction.amount,
      date: transaction.createdAt,
      description: transaction.description,
      status: 'credit', // All payments are credit (money received)
      paymentMethod: transaction.paymentMethod,
      transactionId: transaction.transactionId,
      transactionType: transaction.transactionType,
      relatedBills: transaction.relatedBills,
      notes: transaction.notes,
      createdBy: transaction.createdBy,
      branch: transaction.branch,
      paymentDetails: transaction.paymentDetails
    }));

    return res.json({
      message: "Transaction history fetched successfully",
      error: false,
      success: true,
      data: {
        transactions: formattedTransactions,
        totalTransactions: formattedTransactions.length,
        customerType: customerType,
        customerId: customerId
      }
    });

  } catch (err) {
    console.error('Error fetching transaction history:', err);
    return res.status(500).json({
      message: "Internal server error",
      error: true,
      success: false
    });
  }
}

module.exports = getTransactionHistory;