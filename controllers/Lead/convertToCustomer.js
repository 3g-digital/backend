const Lead = require('../../models/leadModel');
const Customer = require('../../models/customerModel');
const generateOrderId = require('../../helpers/generateOrderId');

const convertToCustomer = async (req, res) => {
  try {
    const { projectType, initialRemark } = req.body;
    
    // Validate project type
    if (!projectType) {
      return res.status(400).json({
        success: false,
        message: 'Project type is required when converting to customer'
      });
    }
    
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
        message: 'Lead already converted to customer'
      });
    }
    
    // Generate project ID and order ID
    const projectId = `PRJ-${Date.now().toString().slice(-6)}`;
    const orderId = await generateOrderId();
    
    // Create new customer from lead data
    const customer = await Customer.create({
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      email: lead.email,
      firmName: lead.firmName,
      whatsappNumber: lead.whatsappNumber,
      address: lead.address,
      age: lead.age,
      branch: lead.branch,
      convertedFromLead: true,
      leadId: lead._id,
      projects: [{
        projectId,
        projectType,
        projectCategory: 'New Installation',
        initialRemark,
        createdAt: new Date()
      }],
      workOrders: [{
        orderId,
        projectId,
        projectType,
        projectCategory: 'New Installation',
        status: 'pending',
        initialRemark,
        createdAt: new Date()
      }],
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    // Update lead as converted
    await Lead.findByIdAndUpdate(req.params.id, {
      isConverted: true,
      convertedToCustomer: customer._id,
      convertedType: 'customer',
      convertedAt: Date.now(),
      updatedBy: req.user.id,
      updatedAt: Date.now()
    });
    
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (err) {
    console.error('Error converting lead to customer:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while converting lead to customer'
    });
  }
};

module.exports = convertToCustomer;