const Dealer = require('../../models/dealerModel');

async function getDealer(req, res) {
  try {
    const { id } = req.params;

    const dealer = await Dealer.findById(id)
      .populate('branch', 'name location address')
      .populate('createdBy', 'firstName lastName username')
      .populate('updatedBy', 'firstName lastName username')
      .populate('remarks.createdBy', 'firstName lastName username');

    if (!dealer) {
      return res.status(404).json({
        success: false,
        message: "Dealer not found"
      });
    }

    // Check if user has access to this dealer (branch-based access control)
    if (req.user.role !== 'admin' && req.user.branch) {
      if (dealer.branch && dealer.branch._id.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this dealer"
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Dealer retrieved successfully",
      data: dealer
    });

  } catch (error) {
    console.error('Error fetching dealer:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dealer"
    });
  }
}

module.exports = getDealer;