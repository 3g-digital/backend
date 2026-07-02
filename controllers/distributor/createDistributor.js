const Distributor = require('../../models/distributorModel');

async function createDistributor(req, res) {
  try {
    const { 
      name, 
      phoneNumber, 
      firmName, 
      whatsappNumber, 
      address, 
      initialRemark,
      branch 
    } = req.body;

    // Validate required fields
    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Name and phone number are required"
      });
    }

    // Check if distributor already exists with same phone number
    const existingDistributor = await Distributor.findOne({ phoneNumber });
    if (existingDistributor) {
      return res.status(400).json({
        success: false,
        message: "Distributor with this phone number already exists"
      });
    }

    // Create distributor data
    const distributorData = {
      name,
      phoneNumber,
      firmName,
      whatsappNumber,
      address,
      createdBy: req.userId
    };

    // Add branch if provided (for admin users) or use user's branch
    if (req.user.role === 'admin' && branch) {
      distributorData.branch = branch;
    } else if (req.user.branch) {
      distributorData.branch = req.user.branch;
    }

    // Add initial remark if provided
    if (initialRemark) {
      distributorData.remarks = [{
        text: initialRemark,
        createdBy: req.userId
      }];
    }

    const distributor = new Distributor(distributorData);
    const savedDistributor = await distributor.save();

    res.status(201).json({
      success: true,
      message: "Distributor created successfully",
      data: savedDistributor
    });

  } catch (error) {
    console.error('Error creating distributor:', error);
    res.status(500).json({
      success: false,
      message: "Server error while creating distributor"
    });
  }
}

module.exports = createDistributor;