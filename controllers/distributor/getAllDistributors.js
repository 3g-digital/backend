const Distributor = require('../../models/distributorModel');

async function getAllDistributors(req, res) {
  try {
    const { branch } = req.query;
    
    // Build query based on user role and branch
    let query = {};
    
    if (req.user.role === 'admin') {
      // Admin can see all distributors or filter by branch
      if (branch) {
        query.branch = branch;
      }
    } else {
      // Manager/Technician can only see distributors from their branch
      if (req.user.branch) {
        query.branch = req.user.branch;
      }
    }

    const distributors = await Distributor.find(query)
      .populate('branch', 'name location')
      .populate('createdBy', 'firstName lastName username')
      .populate('remarks.createdBy', 'firstName lastName username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Distributors retrieved successfully",
      data: distributors
    });

  } catch (error) {
    console.error('Error fetching distributors:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching distributors"
    });
  }
}

module.exports = getAllDistributors;