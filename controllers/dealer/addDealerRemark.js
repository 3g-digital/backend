const Dealer = require('../../models/dealerModel');

async function addDealerRemark(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Remark text is required"
      });
    }

    // Find the dealer
    const dealer = await Dealer.findById(id);
    if (!dealer) {
      return res.status(404).json({
        success: false,
        message: "Dealer not found"
      });
    }

    // Check if user has access to add remark to this dealer
    if (req.user.role !== 'admin' && req.user.branch) {
      if (dealer.branch && dealer.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to add remark to this dealer"
        });
      }
    }

    // Add new remark
    const newRemark = {
      text: text.trim(),
      createdBy: req.userId,
      createdAt: new Date()
    };

    dealer.remarks.push(newRemark);
    dealer.updatedBy = req.userId;
    dealer.updatedAt = new Date();

    const updatedDealer = await dealer.save();
    
    // Populate the updated dealer
    await updatedDealer.populate([
      { path: 'branch', select: 'name location' },
      { path: 'createdBy', select: 'firstName lastName username' },
      { path: 'updatedBy', select: 'firstName lastName username' },
      { path: 'remarks.createdBy', select: 'firstName lastName username' }
    ]);

    res.status(200).json({
      success: true,
      message: "Remark added successfully",
      data: updatedDealer
    });

  } catch (error) {
    console.error('Error adding dealer remark:', error);
    res.status(500).json({
      success: false,
      message: "Server error while adding remark"
    });
  }
}

module.exports = addDealerRemark;