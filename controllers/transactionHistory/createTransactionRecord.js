const TransactionHistory = require('../../models/transactionHistoryModel');

/**
 * Creates a transaction history record for payment tracking
 * @param {Object} transactionData - Transaction details
 * @returns {Object} Created transaction record
 */
async function createTransactionRecord(transactionData) {
  try {
    const {
      customerId,
      customerType,
      customerName,
      amount,
      paymentMethod,
      transactionId,
      paymentDetails,
      relatedBills = [],
      notes,
      branch,
      createdBy,
      transactionType = 'payment_received'
    } = transactionData;

    // Generate description based on transaction type and context
    let description = '';

    if (transactionType === 'due_payment') {
      // This is for due amount clearance (existing bills payment)
      description = `Due payment received - ₹${amount}`;
    } else if (transactionType === 'payment_received' && relatedBills.length === 1) {
      // This is for new bill creation payment
      description = `Payment for Bill #${relatedBills[0].billNumber} - ₹${amount}`;
    } else if (transactionType === 'payment_received' && relatedBills.length > 1) {
      description = `Payment for ${relatedBills.length} bills - ₹${amount}`;
    } else {
      // Fallback
      description = `Payment received - ₹${amount}`;
    }

    // Create transaction record
    const transaction = new TransactionHistory({
      customerId,
      customerType,
      customerName,
      transactionType,
      amount,
      description,
      paymentMethod,
      transactionId,
      paymentDetails,
      relatedBills,
      status: 'completed',
      notes,
      branch,
      createdBy
    });

    const savedTransaction = await transaction.save();

    console.log(`Transaction history created: ${savedTransaction._id} for ${customerType} ${customerName}`);

    return savedTransaction;

  } catch (err) {
    console.error('Error creating transaction record:', err);
    throw err;
  }
}

module.exports = createTransactionRecord;