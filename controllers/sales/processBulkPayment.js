const SalesBill = require('../../models/salesBillModel');
const createTransactionRecord = require('../transactionHistory/createTransactionRecord');

async function processBulkPayment(req, res) {
  try {
    const {
      customerId,
      customerType, // 'dealer' or 'distributor'
      paymentAmount,
      receivedAmount,
      paymentMethod, // 'cash', 'upi', 'bank_transfer', 'cheque'
      transactionId,
      paymentDetails,
      notes
    } = req.body;

    // Validation
    if (!customerId || !customerType || !paymentAmount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, customer type, payment amount, and payment method are required"
      });
    }

    if (!['dealer', 'distributor'].includes(customerType)) {
      return res.status(400).json({
        success: false,
        message: "Customer type must be either 'dealer' or 'distributor'"
      });
    }

    if (!['cash', 'upi', 'bank_transfer', 'cheque'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Payment method must be cash, upi, bank_transfer, or cheque"
      });
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0"
      });
    }

    // Get all pending bills for this customer (oldest first)
    const pendingBills = await SalesBill.find({
      customerId,
      customerType,
      dueAmount: { $gt: 0 }
    }).sort({ createdAt: 1 }); // Oldest first (FIFO)

    if (pendingBills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending bills found for this customer"
      });
    }

    const totalDue = pendingBills.reduce((sum, bill) => sum + bill.dueAmount, 0);

    if (paymentAmount > totalDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${paymentAmount}) exceeds total due amount (₹${totalDue})`
      });
    }

    // Process payment (FIFO - oldest bills first)
    let remainingPayment = paymentAmount;
    const updatedBills = [];

    for (const bill of pendingBills) {
      if (remainingPayment <= 0) break;

      const paymentForThisBill = Math.min(remainingPayment, bill.dueAmount);
      
      // Update bill amounts
      bill.paidAmount += paymentForThisBill;
      bill.dueAmount -= paymentForThisBill;
      
      // Update payment status
      if (bill.dueAmount <= 0) {
        bill.paymentStatus = 'completed';
      } else if (bill.paidAmount > 0) {
        bill.paymentStatus = 'partial';
      }

      // Add payment transaction info and details if provided
      if (transactionId) {
        bill.transactionId = transactionId;
      }

      // Add enhanced payment details
      if (paymentDetails && Object.keys(paymentDetails).length > 0) {
        bill.paymentDetails = { ...bill.paymentDetails, ...paymentDetails };
      }

      // Set received amount for bank transfers
      if (paymentMethod === 'bank_transfer' && receivedAmount) {
        bill.receivedAmount = bill.receivedAmount + parseFloat(receivedAmount);
      } else if (paymentMethod !== 'bank_transfer') {
        bill.receivedAmount = bill.receivedAmount + paymentForThisBill;
      }

      await bill.save();
      
      updatedBills.push({
        billNumber: bill.billNumber,
        paymentApplied: paymentForThisBill,
        remainingDue: bill.dueAmount,
        status: bill.paymentStatus
      });

      remainingPayment -= paymentForThisBill;
    }

    // Calculate updated summary
    const allBillsAfterPayment = await SalesBill.find({
      customerId,
      customerType
    });

    const updatedSummary = {
      totalDueAfterPayment: allBillsAfterPayment.reduce((sum, bill) => sum + bill.dueAmount, 0),
      totalPaidAfterPayment: allBillsAfterPayment.reduce((sum, bill) => sum + bill.paidAmount, 0),
      pendingBillsCount: allBillsAfterPayment.filter(bill => bill.dueAmount > 0).length
    };

    // Create transaction history record
    try {
      // Get customer name from first bill (all bills belong to same customer)
      const firstBill = pendingBills[0];
      const customerName = firstBill.customerName || 'Unknown Customer';

      // Prepare related bills info for transaction record
      const relatedBills = updatedBills.map(bill => ({
        billNumber: bill.billNumber,
        allocatedAmount: bill.paymentApplied
      }));

      // Determine transaction type based on context
      let transactionType = 'due_payment'; // Default: treating as due payment (existing bills payment)

      // Note: This function handles payments for existing bills (due clearance)
      // For new bill payments during bill creation, use 'payment_received' type

      await createTransactionRecord({
        customerId,
        customerType,
        customerName,
        amount: paymentAmount,
        paymentMethod,
        transactionId,
        paymentDetails,
        relatedBills,
        notes,
        branch: req.user.branch,
        createdBy: req.user._id,
        transactionType
      });

      console.log(`Transaction history created for ${customerType} payment: ₹${paymentAmount}`);
    } catch (transactionError) {
      console.error('Error creating transaction history:', transactionError);
      // Continue with response even if transaction history fails
    }

    res.json({
      success: true,
      message: "Payment processed successfully",
      data: {
        paymentAmount,
        receivedAmount: receivedAmount || paymentAmount,
        paymentMethod,
        transactionId: transactionId || null,
        paymentDetails: paymentDetails || null,
        updatedBills,
        summary: updatedSummary,
        notes: notes || ''
      }
    });

  } catch (error) {
    console.error('Error processing bulk payment:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing payment"
    });
  }
}

module.exports = processBulkPayment;