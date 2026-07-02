const SalesBill = require('../../models/salesBillModel');
const TechnicianBill = require('../../models/billModel');
const Customer = require('../../models/customerModel');

async function getCustomerBills(req, res) {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    // Fetch manager bills (SalesBill model)
    const managerBills = await SalesBill.find({
      customerId,
      customerType: 'customer'
    })
    .populate('createdBy', 'firstName lastName email')
    .populate('branch', 'name location')
    .lean(); // Convert to plain JavaScript objects for easier manipulation

    // Fetch technician bills (BillModel)
    const technicianBills = await TechnicianBill.find({
      customer: customerId,
      status: { $ne: 'rejected' } // Exclude rejected bills
    })
    .populate('technician', 'firstName lastName email')
    .populate('customer', 'name phoneNumber')
    .lean();

    // Normalize manager bills to unified format
    const normalizedManagerBills = managerBills.map(bill => ({
      _id: bill._id,
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      customerPhone: bill.customerPhone,
      items: bill.items,
      subtotal: bill.subtotal,
      total: bill.total,
      paidAmount: bill.paidAmount || 0,
      dueAmount: bill.dueAmount || 0,
      paymentStatus: bill.paymentStatus,
      paymentMethod: bill.paymentMethod,
      transactionId: bill.transactionId,
      paymentDetails: bill.paymentDetails,
      createdAt: bill.createdAt,
      createdBy: bill.createdBy,
      createdByRole: bill.createdByRole,
      createdByName: bill.createdByName,
      branch: bill.branch,
      billSource: 'manager', // Identifier for source
      modelType: 'SalesBill' // Model identifier for payment processing
    }));

    // Normalize technician bills to unified format
    const normalizedTechnicianBills = technicianBills.map(bill => ({
      _id: bill._id,
      billNumber: bill.billNumber,
      customerName: bill.customer?.name || 'Unknown',
      customerPhone: bill.customer?.phoneNumber || 'N/A',
      items: bill.items.map(item => ({
        itemName: item.name,
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.amount
      })),
      subtotal: bill.totalAmount,
      total: bill.totalAmount,
      paidAmount: bill.amountPaid || 0,
      dueAmount: bill.amountDue || 0,
      paymentStatus: bill.extendedPaymentStatus === 'paid' ? 'completed' :
                     bill.extendedPaymentStatus === 'partial' ? 'partial' : 'pending',
      paymentMethod: bill.paymentMethod,
      transactionId: bill.transactionId,
      paymentDetails: bill.paymentDetails,
      createdAt: bill.createdAt,
      createdBy: bill.technician,
      createdByRole: bill.createdByRole,
      createdByName: bill.createdByName,
      branch: null, // Technician bills may not have branch info
      billSource: 'technician', // Identifier for source
      modelType: 'TechnicianBill', // Model identifier for payment processing
      workOrderId: bill.orderId,
      status: bill.status
    }));

    // Merge and sort all bills by creation date (latest first)
    const allBills = [...normalizedManagerBills, ...normalizedTechnicianBills]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate combined totals
    const totalBills = allBills.length;
    const totalAmount = allBills.reduce((sum, bill) => sum + bill.total, 0);
    const totalPaid = allBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const totalDue = allBills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const pendingBills = allBills.filter(bill => bill.dueAmount > 0);

    res.json({
      success: true,
      data: {
        bills: allBills,
        summary: {
          totalBills,
          totalAmount,
          totalPaid,
          totalDue,
          pendingBillsCount: pendingBills.length,
          managerBillsCount: normalizedManagerBills.length,
          technicianBillsCount: normalizedTechnicianBills.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching customer bills:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching customer bills"
    });
  }
}

module.exports = getCustomerBills;