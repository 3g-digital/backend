const Distributor = require('../../models/distributorModel');

async function getDistributor(req, res) {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id)
      .populate('branch', 'name location address')
      .populate('createdBy', 'firstName lastName username')
      .populate('updatedBy', 'firstName lastName username')
      .populate('remarks.createdBy', 'firstName lastName username');

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found"
      });
    }

    // Check if user has access to this distributor (branch-based access control)
    if (req.user.role !== 'admin' && req.user.branch) {
      if (distributor.branch && distributor.branch._id.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this distributor"
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Distributor retrieved successfully",
      data: distributor
    });

  } catch (error) {
    console.error('Error fetching distributor:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching distributor"
    });
  }
}

module.exports = getDistributor;