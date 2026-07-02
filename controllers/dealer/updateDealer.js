const Dealer = require('../../models/dealerModel');

async function updateDealer(req, res) {
  try {
    const { id } = req.params;
    const { 
      name, 
      phoneNumber, 
      firmName, 
      whatsappNumber, 
      address 
    } = req.body;

    // Find the dealer
    const dealer = await Dealer.findById(id);
    if (!dealer) {
      return res.status(404).json({
        success: false,
        message: "Dealer not found"
      });
    }

    // Check if user has access to update this dealer
    if (req.user.role !== 'admin' && req.user.branch) {
      if (dealer.branch && dealer.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to update this dealer"
        });
      }
    }

    // Check if phone number is being changed and if it conflicts with another dealer
    if (phoneNumber && phoneNumber !== dealer.phoneNumber) {
      const existingDealer = await Dealer.findOne({ 
        phoneNumber, 
        _id: { $ne: id } 
      });
      if (existingDealer) {
        return res.status(400).json({
          success: false,
          message: "Another dealer with this phone number already exists"
        });
      }
    }

    // Update dealer
    const updateData = {
      ...(name && { name }),
      ...(phoneNumber && { phoneNumber }),
      ...(firmName !== undefined && { firmName }),
      ...(whatsappNumber !== undefined && { whatsappNumber }),
      ...(address !== undefined && { address }),
      updatedBy: req.userId,
      updatedAt: new Date()
    };

    const updatedDealer = await Dealer.findByIdAndUpdate(
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
      message: "Dealer updated successfully",
      data: updatedDealer
    });

  } catch (error) {
    console.error('Error updating dealer:', error);
    res.status(500).json({
      success: false,
      message: "Server error while updating dealer"
    });
  }
}

module.exports = updateDealer;