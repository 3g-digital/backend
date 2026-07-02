const SalesBill = require('../../models/salesBillModel');
const TechnicianBill = require('../../models/billModel');
const createTransactionRecord = require('../transactionHistory/createTransactionRecord');

async function processCustomerBulkPayment(req, res) {
  try {
    const {
      customerId,
      paymentAmount,
      receivedAmount,
      paymentMethod, // 'cash', 'upi', 'bank_transfer', 'cheque'
      transactionId,
      paymentDetails,
      notes
    } = req.body;

    // Validation
    if (!customerId || !paymentAmount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, payment amount, and payment method are required"
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

    // Get all pending manager bills (SalesBill model)
    const pendingManagerBills = await SalesBill.find({
      customerId,
      customerType: 'customer',
      dueAmount: { $gt: 0 }
    }).sort({ createdAt: 1 }); // Oldest first (FIFO)

    // Get all pending technician bills (BillModel)
    const pendingTechnicianBills = await TechnicianBill.find({
      customer: customerId,
      status: { $ne: 'rejected' },
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 }); // Oldest first (FIFO)

    // Combine and sort all pending bills by creation date (FIFO)
    const allPendingBills = [
      ...pendingManagerBills.map(bill => ({ ...bill.toObject(), modelType: 'SalesBill', billSource: 'manager' })),
      ...pendingTechnicianBills.map(bill => ({ ...bill.toObject(), modelType: 'TechnicianBill', billSource: 'technician' }))
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (allPendingBills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending bills found for this customer"
      });
    }

    // Calculate total due from both sources
    const totalDue = allPendingBills.reduce((sum, bill) => {
      return sum + (bill.modelType === 'SalesBill' ? bill.dueAmount : bill.amountDue);
    }, 0);

    if (paymentAmount > totalDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${paymentAmount}) exceeds total due amount (₹${totalDue})`
      });
    }

    // Process payment (FIFO - oldest bills first, regardless of source)
    let remainingPayment = paymentAmount;
    const updatedBills = [];

    for (const billData of allPendingBills) {
      if (remainingPayment <= 0) break;

      if (billData.modelType === 'SalesBill') {
        // Process manager bill
        const bill = await SalesBill.findById(billData._id);
        const paymentForThisBill = Math.min(remainingPayment, bill.dueAmount);

        bill.paidAmount += paymentForThisBill;
        bill.dueAmount -= paymentForThisBill;

        if (bill.dueAmount <= 0) {
          bill.paymentStatus = 'completed';
        } else if (bill.paidAmount > 0) {
          bill.paymentStatus = 'partial';
        }

        if (transactionId) {
          bill.transactionId = transactionId;
        }

        if (paymentDetails && Object.keys(paymentDetails).length > 0) {
          bill.paymentDetails = { ...bill.paymentDetails, ...paymentDetails };
        }

        if (paymentMethod === 'bank_transfer' && receivedAmount) {
          bill.receivedAmount = bill.receivedAmount + parseFloat(receivedAmount);
        } else if (paymentMethod !== 'bank_transfer') {
          bill.receivedAmount = bill.receivedAmount + paymentForThisBill;
        }

        await bill.save();

        updatedBills.push({
          billNumber: bill.billNumber,
          billSource: 'manager',
          paymentApplied: paymentForThisBill,
          remainingDue: bill.dueAmount,
          status: bill.paymentStatus
        });

        remainingPayment -= paymentForThisBill;

      } else if (billData.modelType === 'TechnicianBill') {
        // Process technician bill
        const bill = await TechnicianBill.findById(billData._id);
        const paymentForThisBill = Math.min(remainingPayment, bill.amountDue);

        bill.amountPaid += paymentForThisBill;
        bill.amountDue -= paymentForThisBill;

        if (bill.amountDue <= 0) {
          bill.extendedPaymentStatus = 'paid';
        } else if (bill.amountPaid > 0) {
          bill.extendedPaymentStatus = 'partial';
        }

        if (transactionId) {
          bill.transactionId = transactionId;
        }

        if (paymentDetails && Object.keys(paymentDetails).length > 0) {
          bill.paymentDetails = { ...bill.paymentDetails, ...paymentDetails };
        }

        // Update payment method if not already set or if it was 'pending'
        if (!bill.paymentMethod || bill.paymentMethod === 'pending') {
          bill.paymentMethod = paymentMethod;
        }

        await bill.save();

        updatedBills.push({
          billNumber: bill.billNumber,
          billSource: 'technician',
          paymentApplied: paymentForThisBill,
          remainingDue: bill.amountDue,
          status: bill.extendedPaymentStatus
        });

        remainingPayment -= paymentForThisBill;
      }
    }

    // Calculate updated summary from both sources
    const allManagerBillsAfterPayment = await SalesBill.find({
      customerId,
      customerType: 'customer'
    });

    const allTechnicianBillsAfterPayment = await TechnicianBill.find({
      customer: customerId,
      status: { $ne: 'rejected' }
    });

    const updatedSummary = {
      totalDueAfterPayment:
        allManagerBillsAfterPayment.reduce((sum, bill) => sum + bill.dueAmount, 0) +
        allTechnicianBillsAfterPayment.reduce((sum, bill) => sum + bill.amountDue, 0),
      totalPaidAfterPayment:
        allManagerBillsAfterPayment.reduce((sum, bill) => sum + bill.paidAmount, 0) +
        allTechnicianBillsAfterPayment.reduce((sum, bill) => sum + bill.amountPaid, 0),
      pendingBillsCount:
        allManagerBillsAfterPayment.filter(bill => bill.dueAmount > 0).length +
        allTechnicianBillsAfterPayment.filter(bill => bill.amountDue > 0).length
    };

    // Create transaction history record
    try {
      // Get customer name from first bill (all bills belong to same customer)
      const firstBill = allPendingBills[0];
      const customerName = firstBill.customerName ||
                          (firstBill.customer?.name) ||
                          'Unknown Customer';

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
        customerType: 'customer',
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

      console.log(`Transaction history created for customer payment: ₹${paymentAmount}`);
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
    console.error('Error processing customer bulk payment:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing payment"
    });
  }
}

module.exports = processCustomerBulkPayment;