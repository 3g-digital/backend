const Lead = require('../../models/leadModel');
const Dealer = require('../../models/dealerModel');

const convertToDealer = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== 'admin' && lead.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to convert this lead'
      });
    }

    // Check if already converted
    if (lead.isConverted) {
      return res.status(400).json({
        success: false,
        message: 'Lead already converted'
      });
    }

    // Check if dealer already exists with same phone number
    const existingDealer = await Dealer.findOne({ phoneNumber: lead.phoneNumber });
    if (existingDealer) {
      return res.status(400).json({
        success: false,
        message: 'Dealer with this phone number already exists'
      });
    }

    // Create new dealer from lead data
    const dealer = await Dealer.create({
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      firmName: lead.firmName,
      whatsappNumber: lead.whatsappNumber,
      address: lead.address,
      branch: lead.branch,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      remarks: [{
        text: 'Converted from lead',
        createdBy: req.user.id
      }]
    });

    // Update lead as converted
    await Lead.findByIdAndUpdate(req.params.id, {
      isConverted: true,
      convertedToDealer: dealer._id,
      convertedType: 'dealer',
      convertedAt: Date.now(),
      updatedBy: req.user.id,
      updatedAt: Date.now()
    });

    res.status(200).json({
      success: true,
      message: 'Lead successfully converted to dealer',
      data: dealer
    });
  } catch (err) {
    console.error('Error converting lead to dealer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while converting lead to dealer'
    });
  }
};

module.exports = convertToDealer;