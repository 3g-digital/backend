const Distributor = require('../../models/distributorModel');

async function addDistributorRemark(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Remark text is required"
      });
    }

    // Find the distributor
    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found"
      });
    }

    // Check if user has access to add remark to this distributor
    if (req.user.role !== 'admin' && req.user.branch) {
      if (distributor.branch && distributor.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to add remark to this distributor"
        });
      }
    }

    // Add new remark
    const newRemark = {
      text: text.trim(),
      createdBy: req.userId,
      createdAt: new Date()
    };

    distributor.remarks.push(newRemark);
    distributor.updatedBy = req.userId;
    distributor.updatedAt = new Date();

    const updatedDistributor = await distributor.save();
    
    // Populate the updated distributor
    await updatedDistributor.populate([
      { path: 'branch', select: 'name location' },
      { path: 'createdBy', select: 'firstName lastName username' },
      { path: 'updatedBy', select: 'firstName lastName username' },
      { path: 'remarks.createdBy', select: 'firstName lastName username' }
    ]);

    res.status(200).json({
      success: true,
      message: "Remark added successfully",
      data: updatedDistributor
    });

  } catch (error) {
    console.error('Error adding distributor remark:', error);
    res.status(500).json({
      success: false,
      message: "Server error while adding remark"
    });
  }
}

module.exports = addDistributorRemark;