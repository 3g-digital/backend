const SalesBill = require('../../models/salesBillModel');

async function getDistributorBills(req, res) {
  try {
    const { distributorId } = req.params;
    
    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required"
      });
    }

    // Fetch all bills for this distributor
    const bills = await SalesBill.find({
      customerId: distributorId,
      customerType: 'distributor'
    })
    .sort({ createdAt: -1 }) // Latest first
    .populate('createdBy', 'name email')
    .populate('branch', 'name location');

    // Calculate totals
    const totalBills = bills.length;
    const totalAmount = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const pendingBills = bills.filter(bill => bill.dueAmount > 0);

    res.json({
      success: true,
      data: {
        bills,
        summary: {
          totalBills,
          totalAmount,
          totalPaid,
          totalDue,
          pendingBillsCount: pendingBills.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching distributor bills:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching distributor bills"
    });
  }
}

module.exports = getDistributorBills;