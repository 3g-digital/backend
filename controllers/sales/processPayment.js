const SalesBill = require('../../models/salesBillModel');

async function processPayment(req, res) {
  try {
    const { billId } = req.params;
    const {
      paymentAmount,
      paymentMethod,
      transactionId,
      paymentDetails,
      receivedAmount,
      notes
    } = req.body;

    // Validate required fields
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required"
      });
    }

    if (!paymentMethod || !['cash', 'upi', 'bank_transfer', 'cheque'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment method (cash/upi/bank_transfer/cheque) is required"
      });
    }

    // Find the bill
    const bill = await SalesBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Check if user has access to process payment for this bill
    if (req.user.role !== 'admin' && req.user.branch) {
      if (bill.branch && bill.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to process payment for this bill"
        });
      }
    }

    // Check if bill is already fully paid
    if (bill.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Bill is already fully paid"
      });
    }

    // Calculate new amounts
    const newPaidAmount = bill.paidAmount + parseFloat(paymentAmount);
    const newReceivedAmount = bill.receivedAmount + parseFloat(receivedAmount || paymentAmount);
    const newDueAmount = Math.max(0, bill.total - newPaidAmount);

    // Determine new payment status
    let newPaymentStatus = 'pending';
    if (newPaidAmount >= bill.total) {
      newPaymentStatus = 'completed';
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'partial';
    }

    // Validate method-specific payment details
    let updatedPaymentDetails = { ...bill.paymentDetails };

    if (paymentDetails) {
      switch(paymentMethod) {
        case 'upi':
          if (paymentDetails.upiTransactionId) {
            updatedPaymentDetails.upiTransactionId = paymentDetails.upiTransactionId;
          }
          if (paymentDetails.selectedBankAccount) {
            updatedPaymentDetails.selectedBankAccount = paymentDetails.selectedBankAccount;
          }
          break;

        case 'bank_transfer':
          if (paymentDetails.utrNumber) {
            updatedPaymentDetails.utrNumber = paymentDetails.utrNumber;
          }
          if (paymentDetails.bankName) {
            updatedPaymentDetails.bankName = paymentDetails.bankName;
          }
          if (paymentDetails.transferDate) {
            updatedPaymentDetails.transferDate = paymentDetails.transferDate;
          }
          break;

        case 'cheque':
          if (paymentDetails.chequeStatus) {
            updatedPaymentDetails.chequeStatus = paymentDetails.chequeStatus;
          }
          break;
      }
    }

    // Update bill
    const updateData = {
      paidAmount: newPaidAmount,
      receivedAmount: newReceivedAmount,
      dueAmount: newDueAmount,
      paymentStatus: newPaymentStatus,
      paymentMethod: paymentMethod, // Update payment method if needed
      paymentDetails: updatedPaymentDetails,
      updatedBy: req.userId,
      updatedAt: new Date()
    };

    // Add transaction ID if provided (for online payments)
    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    // Add notes if provided
    if (notes) {
      updateData.notes = bill.notes ? `${bill.notes}\n\nPayment Update: ${notes}` : `Payment Update: ${notes}`;
    }

    const updatedBill = await SalesBill.findByIdAndUpdate(
      billId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('customerId', 'name firmName phoneNumber')
    .populate('branch', 'name location')
    .populate('createdBy', 'firstName lastName username')
    .populate('updatedBy', 'firstName lastName username');

    res.status(200).json({
      success: true,
      message: `Payment of ₹${paymentAmount} processed successfully`,
      data: {
        bill: updatedBill,
        paymentProcessed: {
          amount: paymentAmount,
          method: paymentMethod,
          transactionId: transactionId || null,
          processedBy: req.user.username,
          processedAt: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing payment"
    });
  }
}

module.exports = processPayment;