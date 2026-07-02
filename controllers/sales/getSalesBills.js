const SalesBill = require('../../models/salesBillModel');

async function getSalesBills(req, res) {
  try {
    const { 
      customerType, 
      customerId, 
      paymentStatus, 
      branch,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build query based on user role and parameters
    let query = {};
    
    // Branch filtering
    if (req.user.role === 'admin') {
      if (branch) {
        query.branch = branch;
      }
    } else {
      // Manager/Technician can only see bills from their branch
      if (req.user.branch) {
        query.branch = req.user.branch;
      }
    }

    // Customer type filter
    if (customerType && ['dealer', 'distributor'].includes(customerType)) {
      query.customerType = customerType;
    }

    // Specific customer filter
    if (customerId) {
      query.customerId = customerId;
    }

    // Payment status filter
    if (paymentStatus && ['pending', 'partial', 'completed'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const salesBills = await SalesBill.find(query)
      .populate('customerId', 'name firmName phoneNumber')
      .populate('branch', 'name location')
      .populate('createdBy', 'firstName lastName username')
      .populate('items.itemId', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalBills = await SalesBill.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Sales bills retrieved successfully",
      data: {
        bills: salesBills,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBills / parseInt(limit)),
          totalBills,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sales bills:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching sales bills"
    });
  }
}

module.exports = getSalesBills;