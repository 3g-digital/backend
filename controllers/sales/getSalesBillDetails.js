const SalesBill = require('../../models/salesBillModel');

async function getSalesBillDetails(req, res) {
  try {
    const { billId } = req.params;

    const bill = await SalesBill.findById(billId)
      .populate('customerId', 'name firmName phoneNumber whatsappNumber address')
      .populate('branch', 'name location address phone')
      .populate('createdBy', 'firstName lastName username')
      .populate('updatedBy', 'firstName lastName username')
      .populate('items.itemId', 'name type unit warranty mrp purchasePrice pricing');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Check if user has access to this bill (branch-based access control)
    if (req.user.role !== 'admin' && req.user.branch) {
      if (bill.branch && bill.branch._id.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this bill"
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bill details retrieved successfully",
      data: bill
    });

  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bill details"
    });
  }
}

module.exports = getSalesBillDetails;