const Distributor = require('../../models/distributorModel');

async function updateDistributor(req, res) {
  try {
    const { id } = req.params;
    const { 
      name, 
      phoneNumber, 
      firmName, 
      whatsappNumber, 
      address 
    } = req.body;

    // Find the distributor
    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found"
      });
    }

    // Check if user has access to update this distributor
    if (req.user.role !== 'admin' && req.user.branch) {
      if (distributor.branch && distributor.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to update this distributor"
        });
      }
    }

    // Check if phone number is being changed and if it conflicts with another distributor
    if (phoneNumber && phoneNumber !== distributor.phoneNumber) {
      const existingDistributor = await Distributor.findOne({ 
        phoneNumber, 
        _id: { $ne: id } 
      });
      if (existingDistributor) {
        return res.status(400).json({
          success: false,
          message: "Another distributor with this phone number already exists"
        });
      }
    }

    // Update distributor
    const updateData = {
      ...(name && { name }),
      ...(phoneNumber && { phoneNumber }),
      ...(firmName !== undefined && { firmName }),
      ...(whatsappNumber !== undefined && { whatsappNumber }),
      ...(address !== undefined && { address }),
      updatedBy: req.userId,
      updatedAt: new Date()
    };

    const updatedDistributor = await Distributor.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('branch', 'name location')
    .populate('createdBy', 'firstName lastName username')
    .populate('updatedBy', 'firstName lastName username')
    .populate('remarks.createdBy', 'firstName lastName username');

    res.status(200).json({
      success: true,
      message: "Distributor updated successfully",
      data: updatedDistributor
    });

  } catch (error) {
    console.error('Error updating distributor:', error);
    res.status(500).json({
      success: false,
      message: "Server error while updating distributor"
    });
  }
}

module.exports = updateDistributor;