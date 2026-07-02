const Dealer = require('../../models/dealerModel');

async function getAllDealers(req, res) {
  try {
    const { branch } = req.query;
    
    // Build query based on user role and branch
    let query = {};
    
    if (req.user.role === 'admin') {
      // Admin can see all dealers or filter by branch
      if (branch) {
        query.branch = branch;
      }
    } else {
      // Manager/Technician can only see dealers from their branch
      if (req.user.branch) {
        query.branch = req.user.branch;
      }
    }

    const dealers = await Dealer.find(query)
      .populate('branch', 'name location')
      .populate('createdBy', 'firstName lastName username')
      .populate('remarks.createdBy', 'firstName lastName username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Dealers retrieved successfully",
      data: dealers
    });

  } catch (error) {
    console.error('Error fetching dealers:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dealers"
    });
  }
}

module.exports = getAllDealers;