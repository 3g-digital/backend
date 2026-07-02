const Dealer = require('../../models/dealerModel');

async function createDealer(req, res) {
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

    // Check if dealer already exists with same phone number
    const existingDealer = await Dealer.findOne({ phoneNumber });
    if (existingDealer) {
      return res.status(400).json({
        success: false,
        message: "Dealer with this phone number already exists"
      });
    }

    // Create dealer data
    const dealerData = {
      name,
      phoneNumber,
      firmName,
      whatsappNumber,
      address,
      createdBy: req.userId
    };

    // Add branch if provided (for admin users) or use user's branch
    if (req.user.role === 'admin' && branch) {
      dealerData.branch = branch;
    } else if (req.user.branch) {
      dealerData.branch = req.user.branch;
    }

    // Add initial remark if provided
    if (initialRemark) {
      dealerData.remarks = [{
        text: initialRemark,
        createdBy: req.userId
      }];
    }

    const dealer = new Dealer(dealerData);
    const savedDealer = await dealer.save();

    res.status(201).json({
      success: true,
      message: "Dealer created successfully",
      data: savedDealer
    });

  } catch (error) {
    console.error('Error creating dealer:', error);
    res.status(500).json({
      success: false,
      message: "Server error while creating dealer"
    });
  }
}

module.exports = createDealer;